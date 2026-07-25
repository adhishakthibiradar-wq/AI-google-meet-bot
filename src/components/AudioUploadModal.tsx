import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  Mic,
  MicOff,
  Sparkles,
  AlertCircle,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  Radio,
  FileText,
  CheckCircle2,
  Loader2,
  Music,
} from 'lucide-react';

interface AudioUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (params: {
    title: string;
    audioBase64?: string;
    mimeType?: string;
    textTranscript?: string;
  }) => Promise<void>;
}

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'record' | 'text'>('upload');
  const [title, setTitle] = useState('');

  // Audio File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Live Record state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  // Text state
  const [textTranscript, setTextTranscript] = useState('');

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds maximum limit of 25MB for preview upload.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    const mime = file.type || 'audio/mp3';
    setAudioMimeType(mime);

    const url = URL.createObjectURL(file);
    setAudioPreviewUrl(url);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAudioBase64(reader.result as string);
    };
    reader.readAsDataURL(file);

    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }
  };

  // Handle Live Mic Recording
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        setAudioMimeType(mime);

        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);

        // stop tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      if (!title) {
        setTitle(`Live Audio Recording - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch (err: any) {
      setError('Microphone access failed. Please check browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setRecordedAudioUrl(null);
    setAudioBase64(null);
    setRecordDuration(0);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === 'upload' && !audioBase64) {
      setError('Please select an audio recording file to upload.');
      return;
    }

    if (activeTab === 'record' && !audioBase64) {
      setError('Please record audio before submitting for transcription.');
      return;
    }

    if (activeTab === 'text' && !textTranscript.trim()) {
      setError('Please enter meeting notes or text transcript.');
      return;
    }

    setIsSubmitting(true);
    setProcessingStep('Sending recording to Gemini AI Speech-To-Text...');

    try {
      if (audioBase64) {
        setTimeout(() => setProcessingStep('Transcribing verbatim speech & identifying speakers...'), 1500);
        setTimeout(() => setProcessingStep('Extracting executive summary, action items & task matrix...'), 3500);
      } else {
        setProcessingStep('Extracting meeting points & action items with Gemini AI...');
      }

      await onUpload({
        title: title || (activeTab === 'record' ? 'Live Recorded Audio' : 'Uploaded Audio Recording'),
        audioBase64: audioBase64 || undefined,
        mimeType: audioMimeType,
        textTranscript: textTranscript.trim() || undefined,
      });

      onClose();
      // Reset state
      setTitle('');
      setSelectedFile(null);
      setAudioBase64(null);
      setAudioPreviewUrl(null);
      setRecordedAudioUrl(null);
      setTextTranscript('');
    } catch (err: any) {
      setError(err?.message || 'Failed to process audio recording.');
    } finally {
      setIsSubmitting(false);
      setProcessingStep('');
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Upload Recording & Speech-to-Text</h3>
            <p className="text-xs text-slate-500">
              Upload meeting audio files or record live speech for AI Speech-To-Text & point extraction
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Upload Audio File</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('record');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'record'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-rose-500" />
            <span>Record Live Voice</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'text'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text / Script</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Meeting Title Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Meeting Title / Label
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Product Roadmap Sync"
              className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Audio / Video File (MP3, WAV, M4A, WEBM, OGG, MP4)
              </label>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept="audio/*,video/mp4,video/webm"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                    <Music className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedFile ? selectedFile.name : 'Click or Drag & Drop recording file here'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedFile
                        ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Speech-to-Text`
                        : 'Supports MP3, WAV, M4A, WEBM, OGG, FLAC up to 25MB'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Audio Preview Player */}
              {audioPreviewUrl && (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-md flex items-center gap-3">
                  <FileAudio className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  <audio controls src={audioPreviewUrl} className="w-full h-8" />
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Live Recording */}
          {activeTab === 'record' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Microphone Voice Recording
              </label>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-4">
                {!isRecording && !recordedAudioUrl && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center mx-auto shadow-md transition-transform hover:scale-105"
                    >
                      <Mic className="w-7 h-7" />
                    </button>
                    <p className="text-xs font-bold text-slate-800">Click to Start Recording Speech</p>
                    <p className="text-[11px] text-slate-500">
                      Speak clearly into your microphone to generate instant speech transcript & notes
                    </p>
                  </div>
                )}

                {isRecording && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                      <span className="text-sm font-mono font-bold text-rose-600">
                        REC {formatTimer(recordDuration)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 animate-pulse">Capturing live microphone audio stream...</p>

                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm"
                    >
                      <MicOff className="w-4 h-4" />
                      <span>Stop Recording</span>
                    </button>
                  </div>
                )}

                {!isRecording && recordedAudioUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Voice Recording Complete ({formatTimer(recordDuration)})</span>
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200">
                      <audio controls src={recordedAudioUrl} className="w-full h-8" />
                    </div>

                    <button
                      type="button"
                      onClick={resetRecording}
                      className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Discard & Re-record</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Text Notes */}
          {activeTab === 'text' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Paste Text Transcript or Notes
              </label>
              <textarea
                rows={5}
                value={textTranscript}
                onChange={(e) => setTextTranscript(e.target.value)}
                placeholder={`Example:\nSpeaker 1: We decided to deploy the service on Monday.\nSpeaker 2: I will take responsibility for database backups.\nSpeaker 3: Marketing campaign starts Tuesday.`}
                className="w-full bg-white border border-slate-300 rounded-md p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          )}

          {/* Processing Loading Banner */}
          {isSubmitting && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-md text-indigo-900 text-xs flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
              <div>
                <p className="font-bold">{processingStep}</p>
                <p className="text-[11px] text-indigo-600 mt-0.5">
                  Gemini AI 3.6 Flash is converting audio speech to structured transcript and points...
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Processing Recording with Gemini AI...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Transcribe Audio & Extract Points</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
