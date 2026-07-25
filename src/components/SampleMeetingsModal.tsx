import React from 'react';
import { Sparkles, X, Play, CheckCircle2 } from 'lucide-react';

interface SampleMeetingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (title: string, transcript: any[]) => Promise<void>;
}

export const SampleMeetingsModal: React.FC<SampleMeetingsModalProps> = ({
  isOpen,
  onClose,
  onSelectScenario,
}) => {
  if (!isOpen) return null;

  const scenarios = [
    {
      title: 'Q3 Cloud Architecture & Security Review',
      description: 'Engineering leads review API gateway migration, load testing schedules, and security audits.',
      transcript: [
        {
          id: 's1',
          speaker: 'David Kim (Principal Architect)',
          timestamp: '00:05',
          startTimeSeconds: 5,
          text: 'Good morning team. Today we are reviewing the Q3 Cloud Migration and Security Architecture.',
        },
        {
          id: 's2',
          speaker: 'Rachel Green (Lead DevOps)',
          timestamp: '00:22',
          startTimeSeconds: 22,
          text: 'The Kubernetes cluster upgrade is complete in staging. However, we need Rachel to run stress tests on the database before Friday.',
        },
        {
          id: 's3',
          speaker: 'Marcus Vance (Security Engineer)',
          timestamp: '00:45',
          startTimeSeconds: 45,
          text: 'From the security side, penetration testing identified an unauthenticated rate limit issue on the /api/auth endpoint. Marcus will patch the rate limiter middleware by Wednesday.',
        },
        {
          id: 's4',
          speaker: 'David Kim (Principal Architect)',
          timestamp: '01:10',
          startTimeSeconds: 70,
          text: 'Thanks Marcus. Alex, please assist Marcus with verifying JWT token revocation handling.',
        },
        {
          id: 's5',
          speaker: 'Alex Rivera (Backend Lead)',
          timestamp: '01:30',
          startTimeSeconds: 90,
          text: 'Understood. I will collaborate with Marcus on Tuesday afternoon to complete the JWT revocation audit.',
        },
      ],
    },
    {
      title: 'Sprint Planning & Release Target Assignment',
      description: 'Product team assigns frontend components, database migrations, and QA release candidates.',
      transcript: [
        {
          id: 's1',
          speaker: 'Sarah Jenkins (Product Manager)',
          timestamp: '00:02',
          startTimeSeconds: 2,
          text: 'Welcome to Sprint 14 Planning. Our primary goal is delivering the Google Meet AI Bot integration.',
        },
        {
          id: 's2',
          speaker: 'David Kim (Frontend Developer)',
          timestamp: '00:20',
          startTimeSeconds: 20,
          text: 'I will build the React Live Bot Status Card and Transcript Viewer component with search filtering.',
        },
        {
          id: 's3',
          speaker: 'Elena Rostova (QA Lead)',
          timestamp: '00:40',
          startTimeSeconds: 40,
          text: 'We need automated end-to-end tests for meeting recording and transcription pipelines. Elena will write Cypress tests for the REST API endpoints by next Monday.',
        },
        {
          id: 's4',
          speaker: 'Sarah Jenkins (Product Manager)',
          timestamp: '01:05',
          startTimeSeconds: 65,
          text: 'Great! Alex Rivera will finalize the Puppeteer browser automation scripts.',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Load Demo Meeting Scenarios</h3>
            <p className="text-xs text-slate-500">
              Select a pre-packaged meeting scenario to test instant Gemini AI extraction
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {scenarios.map((scen, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-between gap-4 group"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {scen.title}
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {scen.description}
                </p>
                <span className="inline-block mt-2 text-[10px] text-slate-500 font-mono">
                  {scen.transcript.length} timestamped speech segments
                </span>
              </div>

              <button
                onClick={async () => {
                  await onSelectScenario(scen.title, scen.transcript);
                  onClose();
                }}
                className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm flex-shrink-0 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Simulate</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
