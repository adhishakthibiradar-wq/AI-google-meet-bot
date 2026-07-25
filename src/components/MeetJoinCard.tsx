import React, { useState } from 'react';
import { Video, MicOff, CameraOff, Play, Shield, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface MeetJoinCardProps {
  onJoin: (meetUrl: string, botName: string, autoMuteMic: boolean, autoMuteCam: boolean) => Promise<void>;
  isLoading: boolean;
  onSelectPreset: (url: string, title: string) => void;
}

export const MeetJoinCard: React.FC<MeetJoinCardProps> = ({ onJoin, isLoading, onSelectPreset }) => {
  const [meetUrl, setMeetUrl] = useState('');
  const [botName, setBotName] = useState('AI Meeting Assistant');
  const [autoMuteMic, setAutoMuteMic] = useState(true);
  const [autoMuteCam, setAutoMuteCam] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presets = [
    { title: 'Sprint Review', url: 'https://meet.google.com/sprint-review-2026' },
    { title: 'Product Roadmap', url: 'https://meet.google.com/product-roadmap-q3' },
    { title: 'Architecture Sync', url: 'https://meet.google.com/arch-sync-meet' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let cleanUrl = meetUrl.trim();
    if (!cleanUrl) {
      setErrorMessage('Please enter a Google Meet URL');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (!cleanUrl.includes('meet.google.com')) {
      setErrorMessage('Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij)');
      return;
    }

    try {
      await onJoin(cleanUrl, botName, autoMuteMic, autoMuteCam);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to initialize Google Meet bot');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Join Google Meet Session</h2>
            <p className="text-xs text-slate-500">
              Enter your meeting link to dispatch the automated AI recording bot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Pre-join Mute Active</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Meet URL Input */}
        <div>
          <label htmlFor="meet-url-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Google Meet URL <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="meet-url-input"
              type="text"
              value={meetUrl}
              onChange={(e) => {
                setMeetUrl(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="w-full bg-white border border-slate-300 rounded-md px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" /> Presets:
            </span>
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setMeetUrl(preset.url);
                  setErrorMessage(null);
                  onSelectPreset(preset.url, preset.title);
                }}
                className="text-[11px] font-medium px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Bot Name and Media Toggles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Bot Name */}
          <div>
            <label htmlFor="bot-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Bot Display Name
            </label>
            <input
              id="bot-name-input"
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="AI Meeting Assistant"
              className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Auto Mute Microphone */}
          <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-amber-100 text-amber-700 flex items-center justify-center">
                <MicOff className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Auto Mute Mic</p>
                <p className="text-[10px] text-slate-500">Mute microphone before join</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoMuteMic(!autoMuteMic)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                autoMuteMic ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  autoMuteMic ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Turn Off Camera */}
          <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-sky-100 text-sky-700 flex items-center justify-center">
                <CameraOff className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Auto Off Camera</p>
                <p className="text-[10px] text-slate-500">Turn off camera before join</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoMuteCam(!autoMuteCam)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                autoMuteCam ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  autoMuteCam ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-6 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Launching Browser & Dispatched Bot...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Dispatch Bot & Join Meeting</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
