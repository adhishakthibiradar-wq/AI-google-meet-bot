import React, { useState } from 'react';
import { Bot, Square, Terminal, Mic, Radio, CheckCircle2, AlertCircle, Loader2, Clock, Sparkles } from 'lucide-react';
import { BotLog, BotState, Meeting } from '../types';

interface LiveBotStatusCardProps {
  botState: BotState;
  activeMeeting: Meeting | null;
  logs: BotLog[];
  audioLevel: number;
  elapsedSeconds: number;
  onStopRecording: () => Promise<void>;
  isStopping: boolean;
}

export const LiveBotStatusCard: React.FC<LiveBotStatusCardProps> = ({
  botState,
  activeMeeting,
  logs,
  audioLevel,
  elapsedSeconds,
  onStopRecording,
  isStopping,
}) => {
  const [activeLogTab, setActiveLogTab] = useState<'all' | 'browser' | 'ai'>('all');

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredLogs = logs.filter((log) => {
    if (activeLogTab === 'browser') return ['browser', 'join'].includes(log.source);
    if (activeLogTab === 'ai') return ['ai', 'transcription'].includes(log.source);
    return true;
  });

  const steps = [
    { key: 'connecting', label: '1. Launch & Join' },
    { key: 'in_meeting', label: '2. Record Meeting' },
    { key: 'transcribing', label: '3. Speech-to-Text' },
    { key: 'analyzing', label: '4. Gemini AI Extraction' },
  ];

  const getStepStatus = (stepKey: string) => {
    const order = ['connecting', 'in_meeting', 'transcribing', 'analyzing', 'completed'];
    const currentIndex = order.indexOf(botState);
    const stepIndex = order.indexOf(stepKey);

    if (currentIndex > stepIndex || botState === 'completed') return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm space-y-6 text-white">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            {botState === 'in_meeting' && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {activeMeeting?.title || 'Active Google Meet Session'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {activeMeeting?.meetUrl || 'Connecting to Google Meet...'}
            </p>
          </div>
        </div>

        {/* Live Timer and Control */}
        <div className="flex items-center gap-3">
          {botState === 'in_meeting' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 font-bold">
              <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>REC: {formatTimer(elapsedSeconds)}</span>
            </div>
          )}

          {['connecting', 'in_meeting'].includes(botState) && (
            <button
              onClick={onStopRecording}
              disabled={isStopping}
              className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Finalizing...</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop & Extract AI Summary</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress Steps Timeline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          return (
            <div
              key={step.key}
              className={`p-3 rounded-lg border transition-all ${
                status === 'completed'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : status === 'active'
                  ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>{step.label}</span>
                {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {status === 'active' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    status === 'completed'
                      ? 'w-full bg-emerald-500'
                      : status === 'active'
                      ? 'w-3/4 bg-indigo-500 animate-pulse'
                      : 'w-0'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Audio Waveform Indicator */}
      {botState === 'in_meeting' && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Audio Input Monitor</p>
              <p className="text-[11px] text-slate-300">Capturing live audio stream</p>
            </div>
          </div>

          {/* Equalizer */}
          <div className="flex items-end gap-1 h-10">
            {[30, 70, 40, 90, 60, 85, 30, 65, 100, 50, 80, 40].map((baseHeight, i) => {
              const activeHeight = Math.max(15, (baseHeight * audioLevel) / 100);
              return (
                <div
                  key={i}
                  className="w-1.5 bg-indigo-500 rounded-full transition-all duration-150"
                  style={{ height: `${activeHeight}%` }}
                />
              );
            })}
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 uppercase font-mono">Audio Accuracy</p>
            <p className="text-xl font-mono font-bold text-emerald-400">98.4%</p>
          </div>
        </div>
      )}

      {/* Terminal Log Console */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Live Console & Runtime Logs
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {(['all', 'browser', 'ai'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveLogTab(tab)}
                className={`px-2.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider transition-colors ${
                  activeLogTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-600 italic">No log entries recorded yet...</p>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                <span
                  className={`uppercase font-semibold select-none px-1 rounded text-[10px] ${
                    log.source === 'ai'
                      ? 'bg-purple-500/20 text-purple-300'
                      : log.source === 'browser'
                      ? 'bg-sky-500/20 text-sky-300'
                      : log.source === 'recording'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {log.source}
                </span>
                <span
                  className={
                    log.level === 'error'
                      ? 'text-rose-400'
                      : log.level === 'warn'
                      ? 'text-amber-300'
                      : log.level === 'success'
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
