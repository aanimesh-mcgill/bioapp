import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeToStory,
  updateStoryDraft,
  approveStory,
  rejectStory,
} from '@/services/recordings';
import type { Story } from '@/types';

export function StoryDetailPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { profile } = useAuth();
  const [story, setStory] = useState<Story | null>(null);

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [buyerNotes, setBuyerNotes] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (!storyId) return;
    return subscribeToStory(storyId, (s) => {
      setStory(s);
      if (s) setDraft(s.editedDraft ?? s.draft);
    });
  }, [storyId]);

  if (!story) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  const isHindi = story.outputLanguage === 'hi';
  const isBuyer = profile?.role === 'buyer' || profile?.role === 'admin';

  const handleSave = async () => {
    if (!storyId) return;
    setSaving(true);
    try {
      await updateStoryDraft(storyId, draft);
      setActionMsg('Draft saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!storyId) return;
    await approveStory(storyId, buyerNotes);
    setActionMsg('Story approved!');
  };

  const handleReject = async () => {
    if (!storyId || !buyerNotes.trim()) return;
    await rejectStory(storyId, buyerNotes);
    setActionMsg('Sent back for revision.');
  };

  return (
    <div className="px-4 py-6">
      <Link to="/stories" className="mb-4 inline-block text-sm text-brand-600">
        ← Back to stories
      </Link>

      <div className="mb-4 flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-brand-600">{story.title}</h1>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            story.status === 'approved'
              ? 'bg-green-100 text-green-700'
              : story.status === 'rejected'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
          }`}
        >
          {story.status.replace('_', ' ')}
        </span>
      </div>

      <section className="card mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Transcript
        </h2>
        <p className={`text-sm leading-relaxed text-slate-700 ${isHindi ? 'font-hindi' : ''}`}>
          {story.transcript.text}
        </p>
        {story.transcript.englishTranslation && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">English translation</p>
            <p className="text-sm leading-relaxed text-slate-600">
              {story.transcript.englishTranslation}
            </p>
          </div>
        )}
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Story Draft ({story.perspective === 'first' ? 'First person' : 'Third person'})
        </h2>
        <textarea
          className={`input-field min-h-[200px] resize-y ${isHindi ? 'font-hindi' : ''}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={story.status === 'approved'}
        />
        {story.status !== 'approved' && (
          <button
            className="btn-primary mt-3 w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        )}
      </section>

      {isBuyer && story.status === 'pending_approval' && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Buyer Review</h2>
          <textarea
            className="input-field mb-3 min-h-[80px]"
            placeholder="Notes for the storyteller (optional for approval, required for rejection)"
            value={buyerNotes}
            onChange={(e) => setBuyerNotes(e.target.value)}
          />
          <div className="flex gap-3">
            <button className="btn-primary flex-1" onClick={handleApprove}>
              Approve
            </button>
            <button
              className="btn-secondary flex-1 border-red-600 text-red-600"
              onClick={handleReject}
              disabled={!buyerNotes.trim()}
            >
              Request Changes
            </button>
          </div>
        </section>
      )}

      {actionMsg && (
        <p className="mt-4 text-center text-sm text-green-600">{actionMsg}</p>
      )}
    </div>
  );
}
