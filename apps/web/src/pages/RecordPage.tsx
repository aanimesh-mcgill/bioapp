import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { uploadRecording } from '@/services/recordings';
import type { TranscriptLanguage } from '@/types';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordPage() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const navigate = useNavigate();
  const { isRecording, duration, blob, error, start, stop, reset } = useAudioRecorder();

  const [title, setTitle] = useState('');
  const [languageHint, setLanguageHint] = useState<TranscriptLanguage>(
    profile?.preferences.defaultLanguage ?? 'mixed',
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const handleUpload = async () => {
    if (!user || !activeBook || !blob || !title.trim()) return;
    setUploading(true);
    setUploadError('');
    try {
      const recordingId = await uploadRecording(
        user.uid,
        blob,
        {
          title: title.trim(),
          durationSeconds: duration,
          languageHint,
          hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
          bookId: activeBook.id,
        },
        setUploadProgress,
      );
      navigate(`/stories?recording=${recordingId}`);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!activeBook) {
    return (
      <div className="px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-brand-600">Record Story</h1>
        <div className="card text-sm text-slate-600">
          Select or create a book first from the Books page before recording.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-brand-600">Record Story</h1>
      <p className="mb-4 text-sm text-slate-500">Book: {activeBook.title}</p>

      <input
        className="input-field mb-4"
        placeholder="Story title (e.g. My childhood in Delhi)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isRecording || uploading}
      />

      <label className="mb-6 block text-sm font-medium text-slate-700">
        Language
        <select
          className="input-field mt-1"
          value={languageHint}
          onChange={(e) => setLanguageHint(e.target.value as TranscriptLanguage)}
          disabled={isRecording || uploading}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="mixed">Mixed Hindi-English</option>
        </select>
      </label>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className={`mb-6 flex h-40 w-40 items-center justify-center rounded-full transition ${
            isRecording ? 'bg-red-100 animate-pulse' : 'bg-brand-100'
          }`}
        >
          <span className="text-5xl">{isRecording ? '🔴' : '🎙️'}</span>
        </div>

        <p className="mb-2 text-3xl font-mono font-bold text-brand-600">
          {formatDuration(duration)}
        </p>
        <p className="mb-8 text-sm text-slate-500">
          {isRecording ? 'Recording… tap stop when done' : blob ? 'Recording ready' : 'Tap to start'}
        </p>

        {(error || uploadError) && (
          <p className="mb-4 text-center text-sm text-red-600">{error || uploadError}</p>
        )}

        {uploading && (
          <div className="mb-4 w-full">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-slate-500">
              Uploading… {Math.round(uploadProgress)}%
            </p>
          </div>
        )}

        <div className="flex w-full gap-3">
          {!isRecording && !blob && (
            <button className="btn-primary flex-1" onClick={start} disabled={!title.trim()}>
              Start Recording
            </button>
          )}
          {isRecording && (
            <button className="btn-primary flex-1 bg-red-600" onClick={stop}>
              Stop Recording
            </button>
          )}
          {blob && !isRecording && (
            <>
              <button className="btn-secondary flex-1" onClick={reset} disabled={uploading}>
                Re-record
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleUpload}
                disabled={uploading || !title.trim()}
              >
                {uploading ? 'Uploading…' : 'Upload & Transcribe'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
