import { GoogleGenAI, Type } from '@google/genai';
import { AiSummary, TranscriptSegment } from '../../src/types.js';
import { logger } from '../utilities/logger.js';

export class AiAnalysisService {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
      }
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.ai;
  }

  public async transcribeAndAnalyzeAudio(
    audioBase64: string,
    mimeType: string,
    meetingTitle: string
  ): Promise<{ transcript: TranscriptSegment[]; summary: AiSummary }> {
    logger.info(`Starting Gemini AI Speech-To-Text & Analysis for recording: "${meetingTitle}"`, 'ai');

    const cleanBase64 = audioBase64.includes('base64,')
      ? audioBase64.split('base64,')[1]
      : audioBase64;

    const prompt = `
You are an expert Speech-to-Text transcriber and executive meeting analyst.
Listen carefully to the attached audio recording for the meeting titled "${meetingTitle}".

CRITICAL TASKS:
1. Generate an accurate verbatim speech-to-text transcript with speaker labels (e.g., Speaker 1, Speaker 2 or participant names if mentioned) and timestamp markers (MM:SS).
2. Extract structured executive insights based STRICTLY on what was spoken in the audio recording.

RULES:
- Do NOT invent facts not present in the audio.
- Extract an Executive Summary (2-4 sentences).
- Extract Key Discussion Points.
- Extract Action Items mentioned in the recording.
- Extract Assigned Tasks (task description, owner or "Unknown", priority "High"/"Medium"/"Low", and due date if mentioned).
- Provide a Meeting Conclusion.
`;

    try {
      const ai = this.getClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcriptSegments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING, description: 'Speaker name or label (e.g. Speaker 1)' },
                    timestamp: { type: Type.STRING, description: 'Timestamp in MM:SS format' },
                    startTimeSeconds: { type: Type.NUMBER, description: 'Approximate offset in seconds' },
                    text: { type: Type.STRING, description: 'Transcribed speech text' },
                  },
                  required: ['speaker', 'timestamp', 'text'],
                },
                description: 'Complete speech-to-text transcript of the audio recording.',
              },
              executiveSummary: { type: Type.STRING },
              discussionPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              actionItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              assignedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    task: { type: Type.STRING },
                    owner: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                  },
                  required: ['task', 'owner', 'priority'],
                },
              },
              meetingConclusion: { type: Type.STRING },
            },
            required: [
              'transcriptSegments',
              'executiveSummary',
              'discussionPoints',
              'actionItems',
              'assignedTasks',
              'meetingConclusion',
            ],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Received empty response from Gemini Speech-To-Text API.');
      }

      const parsed = JSON.parse(responseText.trim());

      const transcriptSegments: TranscriptSegment[] = (parsed.transcriptSegments || []).map(
        (seg: any, idx: number) => ({
          id: `stt-seg-${idx}-${Date.now()}`,
          speaker: seg.speaker || `Speaker ${idx + 1}`,
          timestamp: seg.timestamp || `00:${(idx * 15).toString().padStart(2, '0')}`,
          startTimeSeconds: seg.startTimeSeconds || idx * 15,
          text: seg.text || '',
        })
      );

      const assignedTasksFormatted = (parsed.assignedTasks || []).map(
        (t: any, index: number) => ({
          id: `task-${Date.now()}-${index}`,
          task: t.task,
          owner: t.owner || 'Unknown',
          priority: ['High', 'Medium', 'Low'].includes(t.priority) ? t.priority : 'Medium',
          dueDate: t.dueDate || undefined,
          status: 'Pending' as const,
        })
      );

      const summary: AiSummary = {
        executiveSummary: parsed.executiveSummary || '',
        discussionPoints: parsed.discussionPoints || [],
        actionItems: parsed.actionItems || [],
        assignedTasks: assignedTasksFormatted,
        meetingConclusion: parsed.meetingConclusion || '',
        analyzedAt: new Date().toISOString(),
      };

      logger.success(
        `Gemini AI Audio Transcription complete: ${transcriptSegments.length} segments, ${summary.discussionPoints.length} points`,
        'ai'
      );

      return { transcript: transcriptSegments, summary };
    } catch (err: any) {
      logger.error(`Gemini Audio STT Error: ${err?.message || err}`, 'ai');
      throw err;
    }
  }

  public async analyzeTranscript(
    transcript: TranscriptSegment[],
    meetingTitle: string
  ): Promise<AiSummary> {
    logger.info(`Starting Gemini AI analysis for meeting: "${meetingTitle}"`, 'ai');

    if (!transcript || transcript.length === 0) {
      throw new Error('Cannot analyze a meeting without transcript content.');
    }

    const formattedTranscriptText = transcript
      .map((seg) => `[${seg.timestamp}] ${seg.speaker}: ${seg.text}`)
      .join('\n');

    const prompt = `
You are an expert executive meeting assistant. Analyze the following Google Meet transcript and extract structured insights.

CRITICAL MANDATORY RULES:
1. Use ONLY facts explicitly present in the transcript provided. Do NOT invent facts or add external knowledge.
2. If an action item has no assigned owner explicitly stated in the transcript, set the owner to "Unknown".
3. If there are no action items or tasks mentioned in the transcript, return empty arrays [].
4. Provide a concise, high-level Executive Summary (2-4 sentences).
5. Extract key Discussion Points discussed during the meeting.
6. Extract explicitly mentioned Action Items.
7. Extract Assigned Tasks with Task name, Owner name ("Unknown" if unassigned), Priority ("High", "Medium", "Low"), and Optional Due Date if stated.
8. Provide a clear Meeting Conclusion.

MEETING TITLE: ${meetingTitle}

TRANSCRIPT:
${formattedTranscriptText}
`;

    try {
      const ai = this.getClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          temperature: 0.2, // Low temperature for deterministic factual adherence
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: 'Concise executive summary of the meeting.',
              },
              discussionPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Key topics and discussion points covered.',
              },
              actionItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of clear action items extracted from discussion.',
              },
              assignedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    task: { type: Type.STRING, description: 'Task description' },
                    owner: {
                      type: Type.STRING,
                      description: 'Name of team member assigned or "Unknown"',
                    },
                    priority: {
                      type: Type.STRING,
                      description: 'Task priority: High, Medium, or Low',
                    },
                    dueDate: {
                      type: Type.STRING,
                      description: 'Mentioned deadline date or timeframe if any',
                    },
                  },
                  required: ['task', 'owner', 'priority'],
                },
                description: 'Structured task assignments.',
              },
              meetingConclusion: {
                type: Type.STRING,
                description: 'Final conclusion or next steps summary.',
              },
            },
            required: [
              'executiveSummary',
              'discussionPoints',
              'actionItems',
              'assignedTasks',
              'meetingConclusion',
            ],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Received empty response from Gemini API.');
      }

      const parsed = JSON.parse(responseText.trim());

      const assignedTasksFormatted = (parsed.assignedTasks || []).map(
        (t: any, index: number) => ({
          id: `task-${Date.now()}-${index}`,
          task: t.task,
          owner: t.owner || 'Unknown',
          priority: ['High', 'Medium', 'Low'].includes(t.priority)
            ? t.priority
            : 'Medium',
          dueDate: t.dueDate || undefined,
          status: 'Pending' as const,
        })
      );

      const summaryResult: AiSummary = {
        executiveSummary: parsed.executiveSummary || '',
        discussionPoints: parsed.discussionPoints || [],
        actionItems: parsed.actionItems || [],
        assignedTasks: assignedTasksFormatted,
        meetingConclusion: parsed.meetingConclusion || '',
        analyzedAt: new Date().toISOString(),
      };

      logger.success(
        `Gemini AI analysis successfully generated (${summaryResult.discussionPoints.length} points, ${summaryResult.assignedTasks.length} tasks)`,
        'ai'
      );

      return summaryResult;
    } catch (err: any) {
      logger.error(`Gemini AI analysis error: ${err?.message || err}`, 'ai');
      throw err;
    }
  }
}

export const aiAnalysisService = new AiAnalysisService();
