import React, { useState } from 'react';
import { Search, Play, Pause, Download, Copy, Check, User, Clock, Filter, FileText } from 'lucide-react';
import { TranscriptSegment } from '../types';

interface TranscriptViewerProps {
  transcript: TranscriptSegment[];
  meetingTitle: string;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, meetingTitle }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Extract unique speakers
  const uniqueSpeakers = Array.from(new Set(transcript.map((s) => s.speaker)));

  // Filter segments
  const filteredSegments = transcript.filter((seg) => {
    const matchesSearch =
      seg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seg.speaker.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSpeaker = selectedSpeaker === 'all' || seg.speaker === selectedSpeaker;

    return matchesSearch && matchesSpeaker;
  });

  const handleCopyTranscript = () => {
    const text = transcript
      .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    const text = transcript
      .map((s) => `[${s.timestamp}] ${s.speaker}:\n${s.text}\n`)
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${meetingTitle.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const simulateAudioPlayback = (index: number) => {
    setActiveSegmentIndex(index);
    setIsPlaying(true);
    setTimeout(() => {
      setIsPlaying(false);
    }, 2500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      {/* Search and Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Live Speech Transcript</h3>
            <p className="text-xs text-slate-500">
              {filteredSegments.length} of {transcript.length} speech segments
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transcript..."
              className="bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
            />
          </div>

          {/* Speaker Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-7"
            >
              <option value="all">All Speakers ({uniqueSpeakers.length})</option>
              {uniqueSpeakers.map((spk, idx) => (
                <option key={idx} value={spk}>
                  {spk}
                </option>
              ))}
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyTranscript}
            className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Copy full transcript"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownloadTranscript}
            className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Download transcript TXT"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript List Stream */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs italic bg-slate-50 rounded-md border border-slate-100">
            No transcript entries found matching search query.
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isActive = activeSegmentIndex === idx;
            return (
              <div
                key={seg.id || idx}
                className={`p-3.5 rounded-md border transition-all flex items-start space-x-3 text-sm ${
                  isActive
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                    : 'bg-slate-50/60 border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-indigo-600 min-w-[55px] text-xs font-mono pt-0.5">
                  [{seg.timestamp}]
                </span>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-xs">{seg.speaker}</span>
                    <button
                      onClick={() => simulateAudioPlayback(idx)}
                      className="p-1 rounded bg-slate-200/60 hover:bg-indigo-600 hover:text-white text-slate-600 transition-colors"
                      title="Play segment audio"
                    >
                      {isActive && isPlaying ? (
                        <Pause className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">{seg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
