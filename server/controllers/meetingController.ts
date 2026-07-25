import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { aiAnalysisService } from '../services/aiAnalysisService.js';
import { botAutomationService } from '../services/botAutomationService.js';
import { logger } from '../utilities/logger.js';

export class MeetingController {
  public async joinMeeting(req: Request, res: Response): Promise<void> {
    try {
      const { meetUrl, botName, autoMuteMic, autoMuteCam } = req.body;

      if (!meetUrl) {
        res.status(400).json({ error: 'meetUrl is required' });
        return;
      }

      const meeting = await botAutomationService.joinMeeting(
        meetUrl,
        botName || 'AI Google Meet Bot',
        autoMuteMic !== false,
        autoMuteCam !== false
      );

      res.status(200).json({
        message: 'Bot join request initialized successfully',
        meeting,
      });
    } catch (err: any) {
      logger.error(`Failed to join Google Meet: ${err?.message || err}`, 'join');
      res.status(500).json({ error: err?.message || 'Failed to join meeting' });
    }
  }

  public async stopMeeting(req: Request, res: Response): Promise<void> {
    try {
      const meeting = await botAutomationService.stopRecording();
      res.status(200).json({
        message: 'Meeting recording stopped and transcribed successfully',
        meeting,
      });
    } catch (err: any) {
      logger.error(`Failed to stop meeting: ${err?.message || err}`, 'system');
      res.status(500).json({ error: err?.message || 'Failed to stop recording' });
    }
  }

  public getBotStatus(req: Request, res: Response): void {
    const status = botAutomationService.getStatus();
    res.status(200).json(status);
  }

  public getAllMeetings(req: Request, res: Response): void {
    const meetings = db.getAllMeetings();
    res.status(200).json({ meetings });
  }

  public getMeetingById(req: Request, res: Response): void {
    const { id } = req.params;
    const meeting = db.getMeetingById(id);

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    res.status(200).json({ meeting });
  }

  public deleteMeeting(req: Request, res: Response): void {
    const { id } = req.params;
    const success = db.deleteMeeting(id);

    if (!success) {
      res.status(404).json({ error: 'Meeting not found or already deleted' });
      return;
    }

    logger.info(`Deleted meeting ID: ${id}`, 'system');
    res.status(200).json({ message: 'Meeting deleted successfully', id });
  }

  public async simulateMeeting(req: Request, res: Response): Promise<void> {
    try {
      const { title, transcript } = req.body;
      const meeting = await botAutomationService.simulateMeeting(title, transcript);
      res.status(201).json({ message: 'Simulated meeting created', meeting });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to simulate meeting' });
    }
  }

  public async reanalyzeMeeting(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const meeting = db.getMeetingById(id);

      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      if (!meeting.transcript || meeting.transcript.length === 0) {
        res.status(400).json({ error: 'Cannot analyze meeting without transcript' });
        return;
      }

      logger.info(`Re-running Gemini AI analysis for meeting ID: ${id}`, 'ai');
      const newSummary = await aiAnalysisService.analyzeTranscript(meeting.transcript, meeting.title);

      const updated = db.updateMeeting(id, { summary: newSummary });
      res.status(200).json({ message: 'Analysis updated successfully', meeting: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Re-analysis failed' });
    }
  }

  public async uploadAudio(req: Request, res: Response): Promise<void> {
    try {
      const { title, audioBase64, mimeType, textTranscript } = req.body;
      const meetingId = `meet_upload_${Date.now()}`;
      const meetingTitle = title || 'Uploaded Recording Session';

      if (audioBase64 && typeof audioBase64 === 'string') {
        logger.info(`Processing uploaded audio recording for "${meetingTitle}" with Gemini Speech-To-Text...`, 'ai');
        const audioSizeMb = parseFloat((audioBase64.length * 0.75 / (1024 * 1024)).toFixed(1));

        const { transcript, summary } = await aiAnalysisService.transcribeAndAnalyzeAudio(
          audioBase64,
          mimeType || 'audio/webm',
          meetingTitle
        );

        const newMeeting = db.saveMeeting({
          id: meetingId,
          meetUrl: 'https://meet.google.com/uploaded-recording',
          title: meetingTitle,
          status: 'completed',
          startTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          durationSeconds: Math.max(120, transcript.length * 15),
          audioSizeMb: audioSizeMb || 3.5,
          botConfig: {
            botName: 'Speech-To-Text AI Analyst',
            autoMuteMic: true,
            autoMuteCam: true,
          },
          logs: [
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'success',
              message: 'Audio recording uploaded and converted via Gemini AI Speech-To-Text',
              source: 'ai',
            },
          ],
          transcript,
          summary,
        });

        res.status(200).json({
          message: 'Audio recording transcribed and extracted points successfully!',
          meeting: newMeeting,
        });
        return;
      }

      let parsedSegments = [];
      if (textTranscript && typeof textTranscript === 'string') {
        const lines = textTranscript.split('\n').filter((l) => l.trim().length > 0);
        parsedSegments = lines.map((line, idx) => {
          let speaker = 'Speaker';
          let text = line;
          if (line.includes(':')) {
            const parts = line.split(':');
            speaker = parts[0].trim();
            text = parts.slice(1).join(':').trim();
          }
          const minutes = Math.floor((idx * 15) / 60);
          const seconds = (idx * 15) % 60;
          const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          return {
            id: `seg-${idx}`,
            speaker,
            timestamp,
            startTimeSeconds: idx * 15,
            text,
          };
        });
      }

      const meeting = await botAutomationService.simulateMeeting(meetingTitle, parsedSegments);
      res.status(200).json({ message: 'Transcript processed successfully', meeting });
    } catch (err: any) {
      logger.error(`Upload processing error: ${err?.message || err}`, 'ai');
      res.status(500).json({ error: err?.message || 'Recording upload and transcription failed.' });
    }
  }
}

export const meetingController = new MeetingController();
