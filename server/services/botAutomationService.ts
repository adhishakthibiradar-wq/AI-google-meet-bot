import puppeteer, { Browser, Page } from 'puppeteer';
import { BotState, Meeting } from '../../src/types.js';
import { db } from '../database/db.js';
import { recordingService, ActiveRecording } from './recordingService.js';
import { transcriptionService } from './transcriptionService.js';
import { diagnostics } from '../utilities/diagnostics.js';
import { logger } from '../utilities/logger.js';

/** Google Meet takes a few seconds to admit the bot and attach participant audio. */
const JOIN_CONFIRMATION_TIMEOUT_MS = 90_000;

/** The pre-join screen renders its mic/camera controls before the join button becomes usable. */
const PRE_JOIN_CONTROLS_SELECTOR =
  '[role="button"][data-is-muted], [aria-label*="microphone" i], [aria-label*="camera" i]';

/**
 * Only controls that exist once the bot is really inside the call. `[data-call-ended]`
 * is deliberately excluded: Meet renders it on the "You can't join this video call"
 * screen, which previously made a rejected bot look admitted.
 */
const IN_CALL_SELECTOR = '[aria-label*="Leave call" i], button[jsname="CQylAd"]';

/**
 * Copy Meet shows while the bot sits in the waiting room. The hang-up button is already
 * rendered there, so the lobby has to be ruled out before the bot is treated as admitted.
 */
const LOBBY_MESSAGES = [
  'please wait until a meeting host brings you into the call',
  'asking to be let in',
  'you will join the call when someone lets you in',
];

/** Copy Meet shows when the bot is refused or denied. */
const REJECTION_MESSAGES = [
  "you can't join this video call",
  'you have been removed from the meeting',
  'no one responded to your request to join',
  'someone in the call denied your request to join',
  'your request to join was denied',
  'returning to home screen',
];

export class BotAutomationService {
  private activeMeetingId: string | null = null;
  private currentState: BotState = 'idle';
  private browser: Browser | null = null;
  private page: Page | null = null;
  private activeRecording: ActiveRecording | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private elapsedSeconds = 0;
  private lastError: string | null = null;
  private lastFailedMeetingId: string | null = null;

  public validateMeetUrl(url: string): { isValid: boolean; normalizedUrl: string; error?: string } {
    if (!url || typeof url !== 'string') {
      return { isValid: false, normalizedUrl: '', error: 'Google Meet URL is required' };
    }

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    try {
      const parsed = new URL(cleanUrl);
      if (!parsed.hostname.includes('meet.google.com')) {
        return {
          isValid: false,
          normalizedUrl: cleanUrl,
          error: 'URL must belong to Google Meet (meet.google.com)',
        };
      }

      const meetingCode = parsed.pathname.replace(/^\//, '');
      if (!/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(meetingCode)) {
        return {
          isValid: false,
          normalizedUrl: cleanUrl,
          error: 'Invalid Google Meet code in URL (expected format: abc-defg-hij)',
        };
      }

      return { isValid: true, normalizedUrl: cleanUrl };
    } catch (e) {
      return { isValid: false, normalizedUrl: url, error: 'Invalid URL format' };
    }
  }

  public async getStatus() {
    let activeMeeting: Meeting | null = null;
    if (this.activeMeetingId) {
      activeMeeting = await db.getMeetingById(this.activeMeetingId);
    }

    return {
      state: this.currentState,
      currentMeetingId: this.activeMeetingId,
      activeMeeting,
      errorMessage: this.lastError,
      failedMeetingId: this.lastFailedMeetingId,
      logs: logger.getLogs().slice(0, 30),
      audioLevel: this.activeMeetingId ? recordingService.getAudioLevel(this.activeMeetingId) : 0,
      elapsedSeconds: this.elapsedSeconds,
    };
  }

  public async joinMeeting(
    meetUrl: string,
    botName: string = 'AI Meeting Recorder Bot',
    autoMuteMic: boolean = true,
    autoMuteCam: boolean = true
  ): Promise<Meeting> {
    const validation = this.validateMeetUrl(meetUrl);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid Google Meet URL');
    }

    if (this.currentState !== 'idle' && this.currentState !== 'completed' && this.currentState !== 'error') {
      throw new Error(`Bot is currently busy in state: ${this.currentState}`);
    }

    logger.info(`Meet URL validated: ${validation.normalizedUrl}`, 'join');

    const meetingId = `meet_${Date.now()}`;
    this.activeMeetingId = meetingId;
    this.currentState = 'connecting';
    this.elapsedSeconds = 0;
    this.lastError = null;
    this.lastFailedMeetingId = null;

    const newMeeting: Meeting = {
      id: meetingId,
      title: `Google Meet Session (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`,
      meetUrl: validation.normalizedUrl,
      status: 'connecting',
      startTime: new Date().toISOString(),
      durationSeconds: 0,
      transcript: [],
      botConfig: {
        botName,
        autoMuteMic,
        autoMuteCam,
      },
      logs: [],
      createdAt: new Date().toISOString(),
    };

    await db.saveMeeting(newMeeting);
    logger.info(`Initiating bot join sequence for URL: ${validation.normalizedUrl}`, 'join');

    // Browser automation runs in the background; the UI polls /status for progress.
    void this.runBrowserJoinProcess(meetingId, validation.normalizedUrl, botName, autoMuteMic, autoMuteCam);

    return newMeeting;
  }

  private async runBrowserJoinProcess(
    meetingId: string,
    meetUrl: string,
    botName: string,
    autoMuteMic: boolean,
    autoMuteCam: boolean
  ) {
    try {
      await this.launchBrowser();

      logger.info('Creating new browser page...', 'browser');
      this.page = await this.browser!.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });
      // Reuse the real UA of the running Chrome (minus the "Headless" marker). A hardcoded
      // older UA makes Meet serve its "browser no longer supported" page and refuse the call.
      const userAgent = (await this.browser!.userAgent()).replace('HeadlessChrome', 'Chrome');
      await this.page.setUserAgent(userAgent);
      await this.page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      logger.info(`User agent: ${userAgent}`, 'browser');
      this.page.on('pageerror', (err) => logger.error(`Page error: ${String(err)}`, 'browser'));
      // esbuild (via tsx) rewrites evaluated closures with a `__name` helper that only
      // exists in Node, so it is polyfilled in every document the bot opens.
      await this.page.evaluateOnNewDocument(
        'globalThis.__name = globalThis.__name || ((fn) => fn)'
      );
      logger.success('New page created', 'browser');

      const context = this.browser!.defaultBrowserContext();
      await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);
      logger.info('Granted microphone/camera permissions to meet.google.com', 'browser');
      await diagnostics.capture(this.page, 'launch');

      logger.info(`page.goto(${meetUrl})`, 'browser');
      const response = await this.page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      logger.success(
        `Meet page loaded: HTTP ${response?.status() ?? 'n/a'} at ${this.page.url()} — "${await this.page.title()}"`,
        'browser'
      );
      await diagnostics.capture(this.page, 'meet-loaded');

      await this.assertMeetingIsJoinable();
      await this.enterBotName(botName);
      await this.waitForPreJoinControls();
      await this.setPreJoinMedia(autoMuteMic, autoMuteCam);
      await diagnostics.capture(this.page, 'before-join');
      await this.clickJoinButton();
      await this.waitUntilAdmitted(botName);
      await diagnostics.capture(this.page, 'after-join');

      this.currentState = 'in_meeting';
      logger.success('Bot admitted into the Google Meet session', 'join');

      this.activeRecording = await recordingService.startRecording(this.page, meetingId);
      await db.updateMeeting(meetingId,{
        status: 'in_meeting',
        recordingPath: this.activeRecording.filePath,
      });

      this.startTimer();
    } catch (err: any) {
      await diagnostics.capture(this.page, 'error');
      if (err?.stack) logger.error(err.stack, 'browser');
      await this.failMeeting(meetingId, err?.message || String(err));
    }
  }

  private async launchBrowser() {
    const headless = process.env.MEET_BOT_HEADLESS !== 'false';
    const userDataDir = process.env.MEET_BOT_USER_DATA_DIR || undefined;
    const resolvedChrome = await puppeteer.executablePath();
    const executablePath = process.env.MEET_BOT_CHROME_PATH || resolvedChrome;

    const launchOptions = {
      headless,
      userDataDir,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Auto-accept the mic/camera permission prompt without substituting a
        // synthetic device, so only real remote participant audio is captured.
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-blink-features=AutomationControlled',
        '--disable-notifications',
        '--disable-geolocation',
        '--window-size=1280,800',
      ],
    };

    logger.info(
      `Env: MEET_BOT_HEADLESS=${process.env.MEET_BOT_HEADLESS ?? '(unset)'} MEET_BOT_USER_DATA_DIR=${process.env.MEET_BOT_USER_DATA_DIR ?? '(unset)'} MEET_BOT_CHROME_PATH=${process.env.MEET_BOT_CHROME_PATH ?? '(unset)'}`,
      'browser'
    );
    logger.info(`Chrome executable path: ${executablePath}`, 'browser');
    logger.info(`User data directory: ${userDataDir ?? '(default temporary profile)'}`, 'browser');
    logger.info(`Browser launch options: ${JSON.stringify(launchOptions)}`, 'browser');

    try {
      this.browser = await puppeteer.launch(launchOptions);
    } catch (err: any) {
      throw new Error(
        `Puppeteer failed to launch Chrome at "${executablePath}": ${err?.message || err}`
      );
    }

    logger.success(
      `Browser launched: ${await this.browser.version()} (pid ${this.browser.process()?.pid ?? 'n/a'}, headless=${headless})`,
      'browser'
    );
  }

  /**
   * Meet answers with a normal HTTP 200 page even when the call cannot be joined, so the
   * blocking copy is read directly and reported instead of a generic selector timeout.
   */
  private async assertMeetingIsJoinable() {
    if (!this.page) return;

    const pageText = (await this.page.evaluate(() => document.body?.innerText || '')).toLowerCase();
    const blockers: Array<{ match: string; reason: string }> = [
      {
        match: 'join this video call',
        reason:
          'Google Meet refused the call: "You can\'t join this video call". The meeting code is invalid, the call has ended, or it only admits signed-in invitees — set MEET_BOT_USER_DATA_DIR to a Chrome profile signed in to Google.',
      },
      {
        match: 'check your meeting code',
        reason: 'Google Meet rejected the meeting code. Verify the link is current.',
      },
      {
        match: 'no longer supported',
        reason:
          'Google Meet reported an unsupported browser version. Update the Chrome that Puppeteer downloads (npx puppeteer browsers install chrome) or point MEET_BOT_CHROME_PATH at a current Chrome.',
      },
      {
        match: 'sign in to join',
        reason:
          'Google Meet requires a signed-in account for this call. Set MEET_BOT_USER_DATA_DIR to a Chrome profile already signed in to Google.',
      },
    ];

    const hit = blockers.find((b) => pageText.includes(b.match));
    if (hit) {
      await diagnostics.dumpSelectorFailure(this.page, `page text: "${hit.match}"`, 'meeting blocked');
      throw new Error(hit.reason);
    }

    logger.success('Meet page is joinable (no blocking message detected)', 'join');
  }

  private async enterBotName(botName: string) {
    if (!this.page) return;

    const selector = 'input[type="text"][aria-label*="name" i], input[placeholder*="name" i]';
    const nameInput = await this.page.$(selector);
    if (!nameInput) {
      // Signed-in profiles skip the guest name prompt entirely.
      logger.info(`No guest name input present (selector: ${selector})`, 'browser');
      return;
    }

    await nameInput.type(botName, { delay: 50 });
    logger.success(`Entered bot name "${botName}" into the Meet join prompt`, 'browser');
  }

  private async waitForPreJoinControls() {
    if (!this.page) return;

    logger.info(`Waiting for camera/microphone buttons (${PRE_JOIN_CONTROLS_SELECTOR})`, 'join');
    try {
      await this.page.waitForSelector(PRE_JOIN_CONTROLS_SELECTOR, { timeout: 30_000 });
      logger.success('Pre-join camera/microphone controls found', 'join');
    } catch {
      await diagnostics.dumpSelectorFailure(
        this.page,
        PRE_JOIN_CONTROLS_SELECTOR,
        'pre-join controls'
      );
      throw new Error(
        'Google Meet never rendered the pre-join screen (no camera/microphone controls). See screenshots/error.png and screenshots/error.html — the link may be invalid, the call ended, or the page is behind a sign-in wall.'
      );
    }
  }

  private async setPreJoinMedia(autoMuteMic: boolean, autoMuteCam: boolean) {
    if (!this.page) return;

    if (autoMuteMic) {
      logger.info('Turning OFF microphone before joining meeting (Ctrl+D)...', 'join');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('d');
      await this.page.keyboard.up('Control');
      logger.success(`Microphone disabled (data-is-muted=${await this.readMuteState('microphone')})`, 'join');
    }

    if (autoMuteCam) {
      logger.info('Turning OFF camera before joining meeting (Ctrl+E)...', 'join');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('e');
      await this.page.keyboard.up('Control');
      logger.success(`Camera disabled (data-is-muted=${await this.readMuteState('camera')})`, 'join');
    }
  }

  private async readMuteState(device: 'microphone' | 'camera'): Promise<string> {
    if (!this.page) return 'unknown';
    return this.page.evaluate((kind: string) => {
      const control = Array.from(document.querySelectorAll('[role="button"][data-is-muted]')).find(
        (el) => (el.getAttribute('aria-label') || '').toLowerCase().includes(kind)
      );
      return control?.getAttribute('data-is-muted') ?? 'unknown';
    }, device);
  }

  private async clickJoinButton() {
    if (!this.page) return;

    logger.info('Looking for the "Join now" / "Ask to join" button...', 'join');
    const result = await this.page.evaluate(() => {
      const labels = ['Join now', 'Ask to join', 'Join anyway'];
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const button of buttons) {
        const text = (button.textContent || button.getAttribute('aria-label') || '').trim();
        if (labels.some((label) => text.includes(label))) {
          (button as HTMLButtonElement).click();
          return { clicked: text, buttonTexts: [] as string[] };
        }
      }
      return {
        clicked: null,
        buttonTexts: buttons
          .map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim())
          .filter(Boolean)
          .slice(0, 25),
      };
    });

    if (!result.clicked) {
      logger.error(`Buttons found on page: ${JSON.stringify(result.buttonTexts)}`, 'browser');
      await diagnostics.dumpSelectorFailure(
        this.page,
        'button with text "Join now" | "Ask to join" | "Join anyway"',
        'join button'
      );
      throw new Error(
        'Could not find the Google Meet join button — see screenshots/error.png and screenshots/error.html. If the page shows a sign-in wall, set MEET_BOT_USER_DATA_DIR to a Chrome profile signed in to Google.'
      );
    }

    logger.success(`Join button found and clicked: "${result.clicked}"`, 'join');
  }

  /**
   * Confirms the bot is inside the call (the in-call leave button exists) before
   * any recording is started, so a rejected/waiting bot never produces output.
   */
  private async waitUntilAdmitted(botName: string) {
    if (!this.page) return;

    logger.info(`Waiting for admission — polling for ${IN_CALL_SELECTOR}`, 'join');
    const deadline = Date.now() + JOIN_CONFIRMATION_TIMEOUT_MS;
    let announcedLobby = false;

    while (Date.now() < deadline) {
      const pageText = (
        await this.page.evaluate(() => document.body?.innerText || '')
      ).toLowerCase();

      const inLobby = LOBBY_MESSAGES.some((message) => pageText.includes(message));
      if (inLobby) {
        if (!announcedLobby) {
          logger.info(`In the Meet waiting room — the host must admit "${botName}"`, 'join');
          announcedLobby = true;
        }
      } else if (await this.page.$(IN_CALL_SELECTOR)) {
        logger.success('Leave button detected — the bot is inside the call', 'join');
        return;
      }

      const rejection = REJECTION_MESSAGES.find((message) => pageText.includes(message));
      if (rejection) {
        await diagnostics.dumpSelectorFailure(this.page, `page text: "${rejection}"`, 'admission');
        throw new Error(
          `Google Meet rejected the bot while waiting for admission ("${rejection}"). The host must admit "${botName}", or the meeting has already ended.`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await diagnostics.dumpSelectorFailure(this.page, IN_CALL_SELECTOR, 'in-call confirmation');
    throw new Error(
      `The bot was not admitted into the meeting within ${JOIN_CONFIRMATION_TIMEOUT_MS / 1000}s. Ask the host to admit "${botName}" and try again.`
    );
  }

  private startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(async() => {
      this.elapsedSeconds += 1;
      if (this.activeMeetingId) {
        await db.updateMeeting(this.activeMeetingId,{ durationSeconds: this.elapsedSeconds });
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async closeBrowser() {
    try {
      await this.browser?.close();
      logger.info('Closed Puppeteer browser instance.', 'browser');
    } catch {
      // Browser already gone.
    }
    this.browser = null;
    this.page = null;
  }

  /** Marks the meeting as failed, discards partial output and releases the browser. */
  private async failMeeting(meetingId: string, message: string) {
    logger.error(message, 'system');
    this.lastError = message;
    this.lastFailedMeetingId = meetingId;

    this.stopTimer();
    await recordingService.abortRecording(meetingId);
    this.activeRecording = null;
    await this.closeBrowser();

    this.currentState = 'error';
    await db.updateMeeting(meetingId,{
      status: 'error',
      errorMessage: message,
      endTime: new Date().toISOString(),
      durationSeconds: this.elapsedSeconds,
      logs: logger.getLogs(),
    });
    this.activeMeetingId = null;
  }

  public async stopRecording(): Promise<Meeting> {
    if (!this.activeMeetingId) {
      throw new Error('No active meeting recording to stop.');
    }

    const meetingId = this.activeMeetingId;
    const recording = this.activeRecording;
    logger.info(`Stopping meeting recording for meeting ID: ${meetingId}`, 'recording');

    this.stopTimer();

    if (!recording) {
      const message = 'The bot never started recording, so there is no meeting audio to transcribe.';
      await this.failMeeting(meetingId, message);
      throw new Error(message);
    }

    try {
      this.currentState = 'transcribing';
      await db.updateMeeting(meetingId, {
        status: 'transcribing',
        endTime: new Date().toISOString(),
        durationSeconds: this.elapsedSeconds,
      });

      const recordingResult = await recording.stop();
      this.activeRecording = null;
      await this.closeBrowser();

      await db.updateMeeting(meetingId, {
        recordingPath: recordingResult.filePath,
        audioSizeMb: recordingResult.sizeMb,
      });

      const meeting = await db.getMeetingById(meetingId);
      const meetingTitle = meeting?.title || "Google Meet";

      // Transcript and insights are produced by Gemini from the saved recording only.
      const { transcript, summary } = await transcriptionService.transcribeRecording(
        recordingResult.filePath,
        recordingResult.mimeType,
        meetingTitle
      );

      this.currentState = 'analyzing';
      await db.updateMeeting(meetingId, { status: 'analyzing', transcript });

      this.currentState = 'completed';
      const finalMeeting = await db.updateMeeting(meetingId, {
        status: 'completed',
        summary,
        logs: logger.getLogs(),
      });

      logger.success('Meeting workflow finished: recording, transcript and summary stored.', 'system');
      this.activeMeetingId = null;

      return finalMeeting as Meeting;
    } catch (err: any) {
      await this.failMeeting(meetingId, err?.message || String(err));
      throw err;
    }
  }
}

export const botAutomationService = new BotAutomationService();
