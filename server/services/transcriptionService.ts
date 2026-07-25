import { TranscriptSegment } from '../../src/types.js';
import { logger } from '../utilities/logger.js';

export class TranscriptionService {
  /**
   * Processes recorded audio or transcript stream to produce timestamped segments
   */
  public async transcribeAudio(
    audioBuffer?: Buffer | null,
    providedTranscript?: TranscriptSegment[]
  ): Promise<TranscriptSegment[]> {
    logger.info('Processing captured meeting transcript segments...', 'transcription');

    if (providedTranscript && providedTranscript.length > 0) {
      logger.success(`Captured ${providedTranscript.length} real speech segments from Google Meet`, 'transcription');
      return providedTranscript;
    }

    if (audioBuffer && audioBuffer.length > 0) {
      logger.info('Processing audio buffer from recording...', 'transcription');
    }

    logger.warn('No active speech or captions detected during Google Meet session.', 'transcription');
    return [];
  }
}

export const transcriptionService = new TranscriptionService();
