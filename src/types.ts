export type BotState = 'idle' | 'connecting' | 'in_meeting' | 'transcribing' | 'analyzing' | 'completed' | 'error';

export interface BotLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: 'browser' | 'join' | 'recording' | 'transcription' | 'ai' | 'system';
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  timestamp: string; // e.g. "00:15"
  startTimeSeconds: number;
  text: string;
}

export interface AssignedTask {
  id: string;
  task: string;
  owner: string; // "Unknown" if not specified
  priority: 'High' | 'Medium' | 'Low';
  dueDate?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface AiSummary {
  executiveSummary: string;
  discussionPoints: string[];
  actionItems: string[];
  assignedTasks: AssignedTask[];
  meetingConclusion: string;
  analyzedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  meetUrl: string;
  status: BotState;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  recordingPath?: string;
  audioSizeMb?: number;
  transcript: TranscriptSegment[];
  summary?: AiSummary;
  botConfig: {
    botName: string;
    autoMuteMic: boolean;
    autoMuteCam: boolean;
  };
  logs: BotLog[];
  errorMessage?: string;
  createdAt: string;
}

export interface BotStatusResponse {
  state: BotState;
  currentMeetingId: string | null;
  activeMeeting?: Meeting | null;
  /** Set when the last join/record attempt failed, so the UI can show the real reason. */
  errorMessage?: string | null;
  failedMeetingId?: string | null;
  logs: BotLog[];
  audioLevel: number;
  elapsedSeconds: number;
}
