import puppeteer, { Browser, Page } from 'puppeteer';
import { BotState, Meeting } from '../../src/types.js';
import { db } from '../database/db.js';
import { recordingService, ActiveRecording } from './recordingService.js';
import { transcriptionService } from './transcriptionService.js';
import { logger } from '../utilities/logger.js';

/** Google Meet takes a few seconds to admit the bot and attach participant audio. */
const JOIN_CONFIRMATION_TIMEOUT_MS = 90_000;

export class BotAutomationService {
  private activeMeetingId: string | null = null;
  private currentState: BotState = 'idle';
  private browser: Browser | null = null;
  private page: Page | null = null;
  private activeRecording: ActiveRecording | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private elapsedSeconds = 0;

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

  public getStatus() {
    let activeMeeting: Meeting | null = null;
    if (this.activeMeetingId) {
      activeMeeting = db.getMeetingById(this.activeMeetingId) || null;
    }

    return {
      state: this.currentState,
      currentMeetingId: this.activeMeetingId,
      activeMeeting,
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

    const meetingId = `meet_${Date.now()}`;
    this.activeMeetingId = meetingId;
    this.currentState = 'connecting';
    this.elapsedSeconds = 0;

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

    db.saveMeeting(newMeeting);
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
      logger.info('Launching Chromium browser instance with media flags...', 'browser');

      this.browser = await puppeteer.launch({
        headless: process.env.MEET_BOT_HEADLESS !== 'false',
        userDataDir: process.env.MEET_BOT_USER_DATA_DIR || undefined,
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
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);

      logger.info(`Navigating to Google Meet: ${meetUrl}`, 'browser');
      await this.page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      await this.enterBotName(botName);
      await this.setPreJoinMedia(autoMuteMic, autoMuteCam);
      await this.clickJoinButton();
      await this.waitUntilAdmitted(botName);

      this.currentState = 'in_meeting';
      logger.success('Bot admitted into the Google Meet session', 'join');

      this.activeRecording = await recordingService.startRecording(this.page, meetingId);
      db.updateMeeting(meetingId, {
        status: 'in_meeting',
        recordingPath: this.activeRecording.filePath,
      });

      this.startTimer();
    } catch (err: any) {
      await this.failMeeting(meetingId, err?.message || String(err));
    }
  }

  private async enterBotName(botName: string) {
    if (!this.page) return;
    const nameInput = await this.page.$(
      'input[type="text"][aria-label*="name" i], input[placeholder*="name" i]'
    );
    if (!nameInput) return;

    await nameInput.type(botName, { delay: 50 });
    logger.info(`Entered bot name "${botName}" into the Meet join prompt`, 'browser');
  }

  private async setPreJoinMedia(autoMuteMic: boolean, autoMuteCam: boolean) {
    if (!this.page) return;

    if (autoMuteMic) {
      logger.info('Turning OFF microphone before joining meeting...', 'join');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('d');
      await this.page.keyboard.up('Control');
    }

    if (autoMuteCam) {
      logger.info('Turning OFF camera before joining meeting...', 'join');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('e');
      await this.page.keyboard.up('Control');
    }
  }

  private async clickJoinButton() {
    if (!this.page) return;

    logger.info('Looking for the "Join now" / "Ask to join" button...', 'join');
    const clickedLabel = await this.page.evaluate(() => {
      const labels = ['Join now', 'Ask to join', 'Join anyway'];
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const button of buttons) {
        const text = button.textContent?.trim() || '';
        if (labels.some((label) => text.includes(label))) {
          (button as HTMLButtonElement).click();
          return text;
        }
      }
      return null;
    });

    if (!clickedLabel) {
      throw new Error(
        'Could not find the Google Meet join button. The bot may be blocked by a sign-in wall — configure MEET_BOT_USER_DATA_DIR with a signed-in Chrome profile.'
      );
    }

    logger.success(`Clicked Google Meet join button: "${clickedLabel}"`, 'join');
  }

  /**
   * Confirms the bot is inside the call (the in-call leave button exists) before
   * any recording is started, so a rejected/waiting bot never produces output.
   */
  private async waitUntilAdmitted(botName: string) {
    if (!this.page) return;

    logger.info('Waiting for the host to admit the bot into the meeting...', 'join');
    try {
      await this.page.waitForSelector(
        'button[aria-label*="Leave call" i], button[jsname="CQylAd"], [data-call-ended]',
        { timeout: JOIN_CONFIRMATION_TIMEOUT_MS }
      );
    } catch {
      throw new Error(
        `The bot was not admitted into the meeting within ${JOIN_CONFIRMATION_TIMEOUT_MS / 1000}s. Ask the host to admit "${botName}" and try again.`
      );
    }
  }

  private startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds += 1;
      if (this.activeMeetingId) {
        db.updateMeeting(this.activeMeetingId, { durationSeconds: this.elapsedSeconds });
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

    this.stopTimer();
    await recordingService.abortRecording(meetingId);
    this.activeRecording = null;
    await this.closeBrowser();

    this.currentState = 'error';
    db.updateMeeting(meetingId, {
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
      db.updateMeeting(meetingId, {
        status: 'transcribing',
        endTime: new Date().toISOString(),
        durationSeconds: this.elapsedSeconds,
      });

      const recordingResult = await recording.stop();
      this.activeRecording = null;
      await this.closeBrowser();

      db.updateMeeting(meetingId, {
        recordingPath: recordingResult.filePath,
        audioSizeMb: recordingResult.sizeMb,
      });

      const meetingTitle = db.getMeetingById(meetingId)?.title || 'Google Meet';

      // Transcript and insights are produced by Gemini from the saved recording only.
      const { transcript, summary } = await transcriptionService.transcribeRecording(
        recordingResult.filePath,
        recordingResult.mimeType,
        meetingTitle
      );

      this.currentState = 'analyzing';
      db.updateMeeting(meetingId, { status: 'analyzing', transcript });

      this.currentState = 'completed';
      const finalMeeting = db.updateMeeting(meetingId, {
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
