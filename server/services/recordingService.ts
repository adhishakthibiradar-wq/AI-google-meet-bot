import fs from 'fs';
import path from 'path';
import type { Page } from 'puppeteer';
import { logger } from '../utilities/logger.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');
const RECORDING_MIME_TYPE = 'audio/webm';

/** A WebM/Opus stream shorter than this contains no usable speech. */
const MIN_VALID_RECORDING_BYTES = 8 * 1024;

export interface RecordingResult {
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sizeMb: number;
  peakLevel: number;
}

export interface ActiveRecording {
  meetingId: string;
  filePath: string;
  stop: () => Promise<RecordingResult>;
}

interface PageRecordingState {
  file: fs.WriteStream;
  bytesWritten: number;
  peakLevel: number;
  currentLevel: number;
  stopped: boolean;
}

export class RecordingService {
  private states = new Map<string, PageRecordingState>();

  private ensureRecordingDir() {
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }

  public getRecordingPath(meetingId: string): string {
    return path.join(RECORDINGS_DIR, `meet_rec_${meetingId}.webm`);
  }

  public getMimeType(): string {
    return RECORDING_MIME_TYPE;
  }

  /** Instantaneous RMS level (0-100) of the audio currently being recorded. */
  public getAudioLevel(meetingId: string): number {
    return this.states.get(meetingId)?.currentLevel ?? 0;
  }

  /**
   * Records the audio of every remote Google Meet participant by mixing the
   * MediaStreams that Meet attaches to the page's <audio>/<video> elements into
   * a single MediaRecorder, and streams the encoded chunks to disk as they are
   * produced. Nothing is written unless Chromium actually delivers audio data.
   */
  public async startRecording(page: Page, meetingId: string): Promise<ActiveRecording> {
    this.ensureRecordingDir();
    const filePath = this.getRecordingPath(meetingId);

    const state: PageRecordingState = {
      file: fs.createWriteStream(filePath),
      bytesWritten: 0,
      peakLevel: 0,
      currentLevel: 0,
      stopped: false,
    };
    this.states.set(meetingId, state);

    // The dev runner (tsx/esbuild) keeps function names by emitting calls to a `__name`
    // helper, which does not exist inside the page and made every page.evaluate below
    // throw "__name is not defined". Injected as a raw string so it is never transpiled.
    await page.evaluate('globalThis.__name = globalThis.__name || ((fn) => fn)');

    await page.exposeFunction('__meetBotOnAudioChunk', (base64Chunk: string) => {
      if (state.stopped || !base64Chunk) return;
      const buffer = Buffer.from(base64Chunk, 'base64');
      state.bytesWritten += buffer.length;
      state.file.write(buffer);
    });

    await page.exposeFunction('__meetBotOnAudioLevel', (level: number) => {
      state.currentLevel = level;
      if (level > state.peakLevel) state.peakLevel = level;
    });

    await page.exposeFunction('__meetBotOnRecorderError', (message: string) => {
      logger.error(`In-page MediaRecorder error: ${message}`, 'recording');
    });

    await page.evaluate(async (timesliceMs: number) => {
      const w = window as any;

      const audioContext = new AudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const mixDestination = audioContext.createMediaStreamDestination();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      const analyserBuffer = new Uint8Array(analyser.frequencyBinCount);

      const connectedStreams = new Set<string>();

      // Meet renders each remote participant into its own media element; new
      // elements appear whenever somebody joins or starts speaking.
      const connectMediaElements = () => {
        const elements = Array.from(
          document.querySelectorAll<HTMLMediaElement>('audio, video')
        );
        for (const element of elements) {
          const stream = element.srcObject as MediaStream | null;
          if (!stream || connectedStreams.has(stream.id)) continue;
          if (stream.getAudioTracks().length === 0) continue;

          try {
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(mixDestination);
            source.connect(analyser);
            connectedStreams.add(stream.id);
            element.play().catch(() => undefined);
          } catch {
            // Element torn down between query and connect; retried on next tick.
          }
        }
        return connectedStreams.size;
      };

      connectMediaElements();
      const connectInterval = window.setInterval(connectMediaElements, 1000);

      const levelInterval = window.setInterval(() => {
        analyser.getByteTimeDomainData(analyserBuffer);
        let sumSquares = 0;
        for (let i = 0; i < analyserBuffer.length; i += 1) {
          const centered = (analyserBuffer[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / analyserBuffer.length);
        w.__meetBotOnAudioLevel(Math.min(100, Math.round(rms * 300)));
      }, 250);

      const recorder = new MediaRecorder(mixDestination.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      });

      const readAsBase64 = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = String(reader.result || '');
            resolve(result.slice(result.indexOf('base64,') + 'base64,'.length));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });

      let pendingChunks: Promise<void> = Promise.resolve();

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;
        pendingChunks = pendingChunks.then(async () => {
          const base64 = await readAsBase64(event.data);
          await w.__meetBotOnAudioChunk(base64);
        });
      };

      recorder.onerror = (event: Event) => {
        w.__meetBotOnRecorderError(String((event as any)?.error?.message || 'unknown error'));
      };

      recorder.start(timesliceMs);

      w.__meetBotStopCapture = async () => {
        window.clearInterval(connectInterval);
        window.clearInterval(levelInterval);

        if (recorder.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
            recorder.stop();
          });
        }

        await pendingChunks;
        await audioContext.close();
        return { connectedStreams: connectedStreams.size };
      };
    }, 1000);

    logger.success(`Live audio capture started, streaming to ${filePath}`, 'recording');

    return {
      meetingId,
      filePath,
      stop: () => this.stopRecording(page, meetingId),
    };
  }

  private async stopRecording(page: Page, meetingId: string): Promise<RecordingResult> {
    const state = this.states.get(meetingId);
    if (!state) {
      throw new Error(`No active recording found for meeting ${meetingId}`);
    }

    let connectedStreams = 0;
    try {
      const result = await page.evaluate(async () => {
        const stopCapture = (window as any).__meetBotStopCapture;
        if (typeof stopCapture !== 'function') return { connectedStreams: 0 };
        return stopCapture();
      });
      connectedStreams = result?.connectedStreams ?? 0;
    } catch (err: any) {
      logger.error(`Failed to flush in-page recorder: ${err?.message || err}`, 'recording');
    }

    state.stopped = true;
    await new Promise<void>((resolve) => state.file.end(resolve));
    this.states.delete(meetingId);

    const filePath = this.getRecordingPath(meetingId);
    const sizeBytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

    if (sizeBytes < MIN_VALID_RECORDING_BYTES) {
      throw new Error(
        `Meeting audio recording failed: only ${sizeBytes} bytes were captured from ${connectedStreams} participant stream(s). ` +
          'The bot was not admitted into the meeting or no audio was played during the call.'
      );
    }

    const sizeMb = Number((sizeBytes / (1024 * 1024)).toFixed(2));
    logger.success(
      `Recording saved: ${filePath} (${sizeMb} MB from ${connectedStreams} participant stream(s))`,
      'recording'
    );

    return {
      filePath,
      mimeType: RECORDING_MIME_TYPE,
      sizeBytes,
      sizeMb,
      peakLevel: state.peakLevel,
    };
  }

  /** Discards a partially written recording when the session fails. */
  public async abortRecording(meetingId: string): Promise<void> {
    const state = this.states.get(meetingId);
    if (!state) return;

    state.stopped = true;
    await new Promise<void>((resolve) => state.file.end(resolve));
    this.states.delete(meetingId);

    const filePath = this.getRecordingPath(meetingId);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err: any) {
      logger.warn(`Could not delete incomplete recording: ${err?.message || err}`, 'recording');
    }
  }
}

export const recordingService = new RecordingService();
