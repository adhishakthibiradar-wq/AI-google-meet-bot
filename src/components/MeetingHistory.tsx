import React, { useState } from 'react';
import {
  FileText,
  Search,
  Trash2,
  Calendar,
  Clock,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ChevronRight,
  HardDrive,
  CheckCircle2,
} from 'lucide-react';
import { Meeting } from '../types';

interface MeetingHistoryProps {
  meetings: Meeting[];
  onSelectMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (id: string) => Promise<void>;
  onReanalyzeMeeting: (id: string) => Promise<void>;
  selectedMeetingId?: string | null;
}

export const MeetingHistory: React.FC<MeetingHistoryProps> = ({
  meetings,
  onSelectMeeting,
  onDeleteMeeting,
  onReanalyzeMeeting,
  selectedMeetingId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const filteredMeetings = meetings.filter(
    (m) =>
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.meetUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await onDeleteMeeting(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReanalyze = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setReanalyzingId(id);
    try {
      await onReanalyzeMeeting(id);
    } finally {
      setReanalyzingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      {/* Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">Meeting Archives & History</h3>
          <p className="text-xs text-slate-500">
            Stored transcripts, AI summaries, and audio recordings ({filteredMeetings.length})
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search saved meetings..."
            className="bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
        </div>
      </div>

      {/* Meetings Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMeetings.length === 0 ? (
          <div className="col-span-2 text-center py-16 bg-slate-50 rounded-md border border-slate-100 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-700 font-bold">No meeting records found</p>
            <p className="text-xs text-slate-500">
              Join a Google Meet session above or load sample scenarios to create records.
            </p>
          </div>
        ) : (
          filteredMeetings.map((meeting) => {
            const isSelected = selectedMeetingId === meeting.id;
            const taskCount = meeting.summary?.assignedTasks?.length || 0;

            return (
              <div
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting)}
                className={`p-5 rounded-lg border transition-all cursor-pointer space-y-4 ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-1 ring-indigo-400/40'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {meeting.title}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-500 truncate max-w-xs mt-0.5">
                      {meeting.meetUrl}
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      meeting.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : meeting.status === 'in_meeting'
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 animate-pulse'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {meeting.status}
                  </span>
                </div>

                {/* Info Stats Row */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {new Date(meeting.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatDuration(meeting.durationSeconds || 0)}
                  </span>

                  {meeting.audioSizeMb && (
                    <span className="flex items-center gap-1 font-mono">
                      <HardDrive className="w-3 h-3 text-slate-400" />
                      {meeting.audioSizeMb} MB
                    </span>
                  )}

                  {taskCount > 0 && (
                    <span className="flex items-center gap-1 text-indigo-600 font-bold">
                      <Sparkles className="w-3 h-3" />
                      {taskCount} Tasks
                    </span>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                    <span>Inspect Session</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>

                  <div className="flex items-center gap-1">
                    {meeting.transcript && meeting.transcript.length > 0 && (
                      <button
                        onClick={(e) => handleReanalyze(e, meeting.id)}
                        disabled={reanalyzingId === meeting.id}
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
                        title="Re-run Gemini AI extraction"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            reanalyzingId === meeting.id ? 'animate-spin' : ''
                          }`}
                        />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDelete(e, meeting.id)}
                      disabled={deletingId === meeting.id}
                      className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                      title="Delete meeting record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
