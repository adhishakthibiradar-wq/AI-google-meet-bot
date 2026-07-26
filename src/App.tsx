import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import { BotLog, BotState, Meeting } from './types';
import { Header } from './components/Header';
import { MeetJoinCard } from './components/MeetJoinCard';
import { LiveBotStatusCard } from './components/LiveBotStatusCard';
import { AiSummaryView } from './components/AiSummaryView';
import { TranscriptViewer } from './components/TranscriptViewer';
import { MeetingHistory } from './components/MeetingHistory';
import { AudioUploadModal } from './components/AudioUploadModal';
import { AlertCircle, Sparkles, Bot } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  const [botState, setBotState] = useState<BotState>('idle');
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isLoadingJoin, setIsLoadingJoin] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);

  // Poll bot status and fetch meeting list
  const fetchBotStatusAndMeetings = async () => {
    try {
      const status = await api.getStatus();
      setBotState(status.state);
      setLogs(status.logs || []);
      setAudioLevel(status.audioLevel || 0);
      setElapsedSeconds(status.elapsedSeconds || 0);

      const failure = status.errorMessage || status.activeMeeting?.errorMessage;
      if (status.state === 'error' && failure) {
        setBotError(failure);
      }

      if (status.activeMeeting) {
        setActiveMeeting(status.activeMeeting);
        if (!selectedMeeting || selectedMeeting.id === status.activeMeeting.id) {
          setSelectedMeeting(status.activeMeeting);
        }
      }

      // Fetch meeting history list
      const historyRes = await api.getMeetings();
      setMeetings(historyRes.meetings || []);

      if (!selectedMeeting && historyRes.meetings && historyRes.meetings.length > 0) {
        setSelectedMeeting(historyRes.meetings[0]);
      }
    } catch (err: any) {
      // Handle background polling failures gracefully without console.error
      console.warn('Status sync notice:', err?.message || err);
    }
  };

  useEffect(() => {
  fetchBotStatusAndMeetings();

  const shouldPoll = [
    "connecting",
    "in_meeting",
    "transcribing",
    "analyzing",
  ].includes(botState);

  if (!shouldPoll) {
    return;
  }

  const interval = setInterval(fetchBotStatusAndMeetings, 2000);

  return () => clearInterval(interval);
}, [botState]);

  // Handle Dispatching Bot to Meet URL
  const handleJoinMeeting = async (
    meetUrl: string,
    botName: string,
    autoMuteMic: boolean,
    autoMuteCam: boolean
  ) => {
    setIsLoadingJoin(true);
    setBotError(null);
    try {
      const res = await api.joinMeeting({
        meetUrl,
        botName,
        autoMuteMic,
        autoMuteCam,
      });
      setActiveMeeting(res.meeting);
      setSelectedMeeting(res.meeting);
      await fetchBotStatusAndMeetings();
    } catch (err: any) {
      setBotError(err?.message || 'Failed to dispatch the Google Meet bot.');
      throw err;
    } finally {
      setIsLoadingJoin(false);
    }
  };

  // Handle Stopping Recording & Triggering Gemini AI
  const handleStopRecording = async () => {
    setIsStopping(true);
    setBotError(null);
    try {
      const res = await api.stopMeeting();
      setSelectedMeeting(res.meeting);
      setActiveMeeting(null);
      await fetchBotStatusAndMeetings();
    } catch (err: any) {
      setBotError(err?.message || 'Failed to finalize the meeting recording.');
    } finally {
      setIsStopping(false);
    }
  };

  // Handle Re-analyzing Meeting
  const handleReanalyze = async (id: string) => {
    setIsReanalyzing(true);
    try {
      const res = await api.reanalyzeMeeting(id);
      setSelectedMeeting(res.meeting);
      await fetchBotStatusAndMeetings();
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Handle Deleting Meeting
  const handleDeleteMeeting = async (id: string) => {
    await api.deleteMeeting(id);
    if (selectedMeeting?.id === id) {
      setSelectedMeeting(null);
    }
    await fetchBotStatusAndMeetings();
  };

  // Handle Audio Recording Upload & Speech-To-Text
  const handleUploadRecording = async (params: {
    title: string;
    audioBase64?: string;
    mimeType?: string;
    textTranscript?: string;
  }) => {
    const res = await api.uploadAudioOrTranscript(params);
    setSelectedMeeting(res.meeting);
    await fetchBotStatusAndMeetings();
  };

  const isBotActive = ['connecting', 'in_meeting', 'transcribing', 'analyzing'].includes(botState);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Header Navigation */}
      <Header
        botState={botState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        {activeTab === 'dashboard' ? (
          <>
            {/* Bot Failure Banner */}
            {botError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="font-bold">Meeting recording failed</p>
                  <p className="leading-relaxed">{botError}</p>
                  {logs.length > 0 && (
                    <details className="pt-1">
                      <summary className="cursor-pointer font-semibold">Bot diagnostics log</summary>
                      <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-rose-900/80 max-h-48 overflow-auto">
                        {logs.map((log) => (
                          <li key={log.id}>
                            [{log.source}] {log.message}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Top Section: Join Card OR Active Bot Status Card */}
            {isBotActive ? (
              <LiveBotStatusCard
                botState={botState}
                activeMeeting={activeMeeting}
                logs={logs}
                audioLevel={audioLevel}
                elapsedSeconds={elapsedSeconds}
                onStopRecording={handleStopRecording}
                isStopping={isStopping}
              />
            ) : (
              <MeetJoinCard onJoin={handleJoinMeeting} isLoading={isLoadingJoin} />
            )}

            {/* Bottom Section: Active or Selected Meeting Details */}
            {selectedMeeting ? (
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Meeting Intelligence & Analysis</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">
                      ({selectedMeeting.title})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('history')}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>View All Archived ({meetings.length})</span>
                    </button>
                  </div>
                </div>

                {/* Gemini AI Summary Dashboard */}
                <AiSummaryView
                  summary={selectedMeeting.summary}
                  meetingTitle={selectedMeeting.title}
                  onReanalyze={() => handleReanalyze(selectedMeeting.id)}
                  isReanalyzing={isReanalyzing}
                />

                {/* Transcript Viewer */}
                <TranscriptViewer
                  transcript={selectedMeeting.transcript || []}
                  meetingTitle={selectedMeeting.title}
                />
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                <Bot className="w-10 h-10 text-indigo-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">No Meeting Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Enter a Google Meet link above to dispatch the recording bot, or upload an existing meeting recording to transcribe it.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-5 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Upload a Meeting Recording</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* History Tab */
          <div className="space-y-6">
            <MeetingHistory
              meetings={meetings}
              onSelectMeeting={(m) => {
                setSelectedMeeting(m);
                setActiveTab('dashboard');
              }}
              onDeleteMeeting={handleDeleteMeeting}
              onReanalyzeMeeting={handleReanalyze}
              selectedMeetingId={selectedMeeting?.id}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <AudioUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUploadRecording}
      />
    </div>
  );
}
