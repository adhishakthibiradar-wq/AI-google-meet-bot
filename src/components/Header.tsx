import React from 'react';
import { Activity, FileText, Radio } from 'lucide-react';
import { BotState } from '../types';

interface HeaderProps {
  botState: BotState;
  activeTab: 'dashboard' | 'history';
  setActiveTab: (tab: 'dashboard' | 'history') => void;
  onOpenUploadModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  botState,
  activeTab,
  setActiveTab,
  onOpenUploadModal,
}) => {
  const isBusy = ['connecting', 'in_meeting', 'transcribing', 'analyzing'].includes(botState);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-sm">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base sm:text-lg tracking-tight text-white">
                MeetBot AI
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                PRO POLISH
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Enterprise Meeting Intelligence & Autonomous Bot
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-md border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Active Session</span>
            {isBusy && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Meeting History</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors shadow-sm"
            title="Upload audio/video recordings or record live speech for Speech-to-Text & Gemini AI points extraction"
          >
            <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">Upload Recording & STT</span>
          </button>
        </div>
      </div>
    </header>
  );
};
