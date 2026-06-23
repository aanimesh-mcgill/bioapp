import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { subscribeToRecordings, getStoryForRecording } from '@/services/recordings';
import type { Recording, Story } from '@/types';

const statusLabels: Record<Recording['status'], string> = {
  uploading: 'Uploading…',
  transcribing: 'Transcribing…',
  generating: 'Writing story…',
  ready: 'Ready',
  error: 'Error',
};

const statusColors: Record<Recording['status'], string> = {
  uploading: 'bg-blue-100 text-blue-700',
  transcribing: 'bg-amber-100 text-amber-700',
  generating: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export function StoriesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('recording');

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [storyMap, setStoryMap] = useState<Record<string, Story | null>>({});

  useEffect(() => {
    if (!user) return;
    return subscribeToRecordings(user.uid, setRecordings);
  }, [user]);

  useEffect(() => {
    recordings.forEach(async (r) => {
      if (r.status === 'ready' && !storyMap[r.id]) {
        const story = await getStoryForRecording(r.id);
        setStoryMap((prev) => ({ ...prev, [r.id]: story }));
      }
    });
  }, [recordings, storyMap]);

  if (recordings.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 text-5xl">📖</span>
        <h2 className="text-xl font-semibold text-brand-600">No stories yet</h2>
        <p className="mt-2 text-slate-600">Record your first memory to get started.</p>
        <Link to="/record" className="btn-primary mt-6">
          Record Now
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-brand-600">My Stories</h1>
      <div className="space-y-3">
        {recordings.map((r) => {
          const story = storyMap[r.id];
          const isHighlighted = r.id === highlightId;

          return (
            <div
              key={r.id}
              className={`card ${isHighlighted ? 'ring-2 ring-brand-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900">{r.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.createdAt.toLocaleDateString()} · {r.languageHint ?? 'mixed'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[r.status]}`}
                >
                  {statusLabels[r.status]}
                </span>
              </div>

              {r.status === 'error' && r.errorMessage && (
                <p className="mt-2 text-xs text-red-600">{r.errorMessage}</p>
              )}

              {(r.status === 'transcribing' || r.status === 'generating') && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  Processing your audio with Whisper…
                </div>
              )}

              {story && (
                <Link
                  to={`/stories/${story.id}`}
                  className="mt-3 block text-sm font-semibold text-brand-600"
                >
                  View draft →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
