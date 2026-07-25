import React, { useState } from 'react';
import {
  Sparkles,
  FileCheck2,
  ListTodo,
  UserCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  AlertCircle,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import { AiSummary, AssignedTask } from '../types';

interface AiSummaryViewProps {
  summary?: AiSummary;
  meetingTitle: string;
  onReanalyze?: () => Promise<void>;
  isReanalyzing?: boolean;
}

export const AiSummaryView: React.FC<AiSummaryViewProps> = ({
  summary,
  meetingTitle,
  onReanalyze,
  isReanalyzing,
}) => {
  const [copied, setCopied] = useState(false);
  const [tasks, setTasks] = useState<AssignedTask[]>(summary?.assignedTasks || []);

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
        <Sparkles className="w-8 h-8 text-indigo-600 mx-auto animate-bounce" />
        <h3 className="text-base font-bold text-slate-900">AI Gemini Insights Pending</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Meeting recording or transcript is currently being processed by Google Gemini AI. Structured notes, action items, and task assignments will appear here once ready.
        </p>
      </div>
    );
  }

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' }
          : t
      )
    );
  };

  const handleCopyText = () => {
    const textToCopy = `
=== MEETING SUMMARY: ${meetingTitle} ===
Analyzed: ${new Date(summary.analyzedAt).toLocaleString()}

EXECUTIVE SUMMARY:
${summary.executiveSummary}

KEY DISCUSSION POINTS:
${summary.discussionPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

ACTION ITEMS:
${summary.actionItems.map((a, i) => `- ${a}`).join('\n')}

ASSIGNED TASKS:
${tasks
  .map(
    (t) =>
      `• [${t.status}] ${t.task} | Owner: ${t.owner} | Priority: ${t.priority}${
        t.dueDate ? ` | Due: ${t.dueDate}` : ''
      }`
  )
  .join('\n')}

CONCLUSION:
${summary.meetingConclusion}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const markdown = `# Meeting Analysis: ${meetingTitle}
*Analyzed on ${new Date(summary.analyzedAt).toLocaleString()}*

## Executive Summary
${summary.executiveSummary}

## Key Discussion Points
${summary.discussionPoints.map((p) => `- ${p}`).join('\n')}

## Action Items
${summary.actionItems.map((a) => `- [ ] ${a}`).join('\n')}

## Assigned Tasks
| Task | Owner | Priority | Status | Due Date |
|------|-------|----------|--------|----------|
${tasks
  .map(
    (t) =>
      `| ${t.task} | **${t.owner}** | ${t.priority} | ${t.status} | ${t.dueDate || 'N/A'} |`
  )
  .join('\n')}

## Meeting Conclusion
${summary.meetingConclusion}
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-summary-${meetingTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">AI Gemini Insights & Summary</h3>
            <p className="text-xs text-slate-500">
              Analyzed at {new Date(summary.analyzedAt).toLocaleTimeString()} • Verified audio/transcript extraction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReanalyze && (
            <button
              onClick={onReanalyze}
              disabled={isReanalyzing}
              className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Re-run Gemini AI extraction on transcript"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
              <span>Re-Analyze</span>
            </button>
          )}

          <button
            onClick={handleCopyText}
            className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Finalize & Export Notes</span>
          </button>
        </div>
      </div>

      {/* Grid: Executive Summary & Discussion Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Executive Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
            <FileCheck2 className="w-4 h-4" />
            <span>Executive Summary</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-100">
            {summary.executiveSummary}
          </p>
        </div>

        {/* Meeting Conclusion Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            <span>Meeting Conclusion & Next Steps</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-100">
            {summary.meetingConclusion}
          </p>
        </div>
      </div>

      {/* Key Discussion Points */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Key Discussion Points ({summary.discussionPoints.length})</span>
          </div>
        </div>

        <div className="space-y-2">
          {summary.discussionPoints.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No discussion points extracted.</p>
          ) : (
            summary.discussionPoints.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3.5 rounded-md bg-slate-50 border border-slate-100 text-sm text-slate-700"
              >
                <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span className="leading-snug">{point}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Items List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
          <ListTodo className="w-4 h-4 text-amber-600" />
          <span>Extracted Action Items ({summary.actionItems.length})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.actionItems.length === 0 ? (
            <div className="col-span-2 p-4 text-center rounded-md bg-slate-50 border border-slate-100 text-xs text-slate-400">
              No explicit action items were identified in the transcript.
            </div>
          ) : (
            summary.actionItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-md bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs text-slate-800"
              >
                <div className="w-4 h-4 mt-0.5 border border-slate-300 rounded bg-white flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-indigo-600 rounded-sm" />
                </div>
                <span className="font-medium leading-snug">{item}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assigned Tasks Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Assigned Tasks Matrix ({tasks.length})</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Unspecified owners defaulted to "Unassigned"
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Done</th>
                <th className="px-4 py-3">Task Description</th>
                <th className="px-4 py-3">Assigned Owner</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                    No assigned tasks found in meeting notes.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      task.status === 'Completed' ? 'opacity-60 bg-slate-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={task.status === 'Completed'}
                        onChange={() => toggleTaskStatus(task.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className={task.status === 'Completed' ? 'line-through text-slate-400' : ''}>
                        {task.task}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200">
                        {task.owner}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === 'High'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : task.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {task.dueDate || 'Unspecified'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
