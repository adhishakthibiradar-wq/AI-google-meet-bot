import fs from 'fs';
import { AiSummary, TranscriptSegment } from '../../src/types.js';
import { aiAnalysisService } from './aiAnalysisService.js';
import { logger } from '../utilities/logger.js';

/** Gemini inline audio payloads are limited; ~18MB of base64 is the safe ceiling. */
const MAX_RECORDING_BYTES = 18 * 1024 * 1024;

export class TranscriptionService {
  /**
   * Transcribes a recording that was actually captured from the meeting.
   * Throws when the file is missing, empty or contains no speech so that the
   * caller can surface a real error instead of inventing transcript content.
   */
  public async transcribeRecording(
    filePath: string,
    mimeType: string,
    meetingTitle: string
  ): Promise<{ transcript: TranscriptSegment[]; summary: AiSummary }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Recording file not found at ${filePath}. Nothing to transcribe.`);
    }

    const { size } = fs.statSync(filePath);
    if (size === 0) {
      throw new Error('Recording file is empty. No meeting audio was captured.');
    }

    if (size > MAX_RECORDING_BYTES) {
      throw new Error(
        `Recording is ${(size / (1024 * 1024)).toFixed(1)}MB which exceeds the ${MAX_RECORDING_BYTES / (1024 * 1024)}MB Gemini inline audio limit.`
      );
    }

    logger.info(
      `Transcribing recorded meeting audio (${(size / (1024 * 1024)).toFixed(2)} MB) with Gemini speech-to-text...`,
      'transcription'
    );

    const audioBase64 = fs.readFileSync(filePath).toString('base64');
    const result = await aiAnalysisService.transcribeAndAnalyzeAudio(audioBase64, mimeType, meetingTitle);

    if (result.transcript.length === 0) {
      throw new Error(
        'Gemini detected no speech in the recorded meeting audio. No transcript or summary was generated.'
      );
    }

    logger.success(
      `Transcribed ${result.transcript.length} speech segments from the meeting recording`,
      'transcription'
    );

    return result;
  }
}

export const transcriptionService = new TranscriptionService();
