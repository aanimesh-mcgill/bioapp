import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BilingualBtn, T } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { usePickText } from '@/context/UiLocaleContext';
import {
  contributorStoryMeta,
  contributorStoryThumb,
  isContributorStorySubmitted,
} from '@/lib/contributorStories';
import { assignStoryToBook } from '@/services/books';
import {
  approveSession,
  deleteStorySession,
  rejectSession,
} from '@/services/storySessions';
import type { Chapter, StorySession } from '@/types';

function submissionStatus(
  story: StorySession,
  t: ReturnType<typeof usePickText>,
): { label: string; className: string } {
  if (story.status === 'pending_approval') {
    return {
      label: t({ en: 'Needs review', hi: 'समीक्षा लंबित' }),
      className: 'bg-amber-100 text-amber-800',
    };
  }
  if (['transcribing', 'generating'].includes(story.status)) {
    return {
      label: t({ en: 'Processing', hi: 'प्रोसेस हो रहा' }),
      className: 'bg-slate-100 text-slate-600',
    };
  }
  if (isContributorStorySubmitted(story)) {
    return {
      label: t({ en: 'Submitted', hi: 'जमा' }),
      className: 'bg-green-100 text-green-800',
    };
  }
  return {
    label: story.status.replace('_', ' '),
    className: 'bg-slate-100 text-slate-600',
  };
}

export function BookContributorSubmissionsSection({
  stories,
  chapters,
  albumBookId,
}: {
  stories: StorySession[];
  chapters: Chapter[];
  albumBookId: string | null;
}) {
  const t = usePickText();
  const [addStoryId, setAddStoryId] = useState<string | null>(null);
  const [revisionStoryId, setRevisionStoryId] = useState<string | null>(null);
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addStory = stories.find((s) => s.id === addStoryId);

  const closeModals = () => {
    if (busy) return;
    setAddStoryId(null);
    setRevisionStoryId(null);
    setDeleteStoryId(null);
    setSelectedChapterId('');
    setRevisionNotes('');
    setError('');
  };

  const handleAdd = async () => {
    if (!addStoryId || !selectedChapterId || !albumBookId) return;
    setBusy(true);
    setError('');
    try {
      const story = stories.find((s) => s.id === addStoryId);
      if (story?.status === 'pending_approval') {
        await approveSession(addStoryId);
      }
      await assignStoryToBook(addStoryId, albumBookId, selectedChapterId);
      closeModals();
    } catch {
      setError(t({ en: 'Could not add story to the book.', hi: 'कहानी पुस्तक में नहीं जोड़ी जा सकी।' }));
    } finally {
      setBusy(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionStoryId || !revisionNotes.trim()) return;
    setBusy(true);
    setError('');
    try {
      await rejectSession(revisionStoryId, revisionNotes.trim());
      closeModals();
    } catch {
      setError(t({ en: 'Could not send revision request.', hi: 'संशोधन अनुरोध नहीं भेजा जा सका।' }));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStoryId) return;
    setBusy(true);
    setError('');
    try {
      await deleteStorySession(deleteStoryId);
      closeModals();
    } catch {
      setError(t({ en: 'Could not delete submission.', hi: 'जमा की गई कहानी हटाई नहीं जा सकी।' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4">
      <p className="heritage-label mb-2 text-brand-600">
        {t({ en: 'Contributor submissions', hi: 'योगदानकर्ता की कहानियाँ' })}
      </p>
      <p className="mb-3 text-xs text-heritage-muted">
        {t({
          en: 'Stories submitted for this book. Review, add to a chapter, request changes, or remove.',
          hi: 'इस पुस्तक के लिए जमा की गई कहानियाँ। समीक्षा करें, अध्याय में जोड़ें, बदलाव माँगें, या हटाएं।',
        })}
      </p>

      <div className="card divide-y divide-heritage-line/60 p-0">
        {stories.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-heritage-muted">
            {t({
              en: 'No contributor stories waiting for review. When someone submits via your invite link, they will appear here.',
              hi: 'समीक्षा के लिए कोई योगदान कहानी नहीं। जब कोई आपके निमंत्रण लिंक से जमा करेगा, वे यहाँ दिखेंगी।',
            })}
          </p>
        ) : (
          stories.map((story) => {
          const thumb = contributorStoryThumb(story);
          const status = submissionStatus(story, t);

          return (
            <article key={story.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-white"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-heritage-line/60 text-lg">
                    {(story.contributorName ?? '?')[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-heritage-ink">{story.title}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-heritage-muted">
                    {story.contributorName}
                    {story.contributorRelationship ? ` · ${story.contributorRelationship}` : ''}
                    {' · '}
                    {contributorStoryMeta(story, t)}
                  </p>
                </div>
                <Link
                  to={`/stories/${story.id}`}
                  className="shrink-0 text-sm font-semibold text-brand-600"
                >
                  <T en="Review" hi="देखें" />
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={!albumBookId || chapters.length === 0}
                  onClick={() => {
                    setAddStoryId(story.id);
                    setSelectedChapterId(chapters[0]?.id ?? '');
                    setError('');
                  }}
                >
                  <BilingualBtn en="Add to book" hi="पुस्तक में जोड़ें" />
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-xs"
                  onClick={() => {
                    setRevisionStoryId(story.id);
                    setRevisionNotes('');
                    setError('');
                  }}
                >
                  <BilingualBtn en="Request revision" hi="संशोधन माँगें" />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setDeleteStoryId(story.id);
                    setError('');
                  }}
                >
                  <BilingualBtn en="Delete" hi="हटाएं" />
                </button>
              </div>
            </article>
          );
        })
        )}
      </div>

      <Modal
        open={addStoryId !== null}
        onClose={closeModals}
        title={t({ en: 'Add to book', hi: 'पुस्तक में जोड़ें' })}
        busy={busy}
      >
        {addStory && (
          <p className="mb-3 text-sm text-slate-600">
            <span className="font-medium text-heritage-ink">{addStory.title}</span>
            {addStory.status === 'pending_approval' && (
              <span className="mt-1 block text-xs text-amber-700">
                {t({ en: 'Will be approved when added to a chapter.', hi: 'अध्याय में जोड़ते समय स्वीकृत होगी।' })}
              </span>
            )}
          </p>
        )}
        {chapters.length === 0 ? (
          <p className="text-sm text-slate-600">
            {t({ en: 'Create a chapter first, then add this story.', hi: 'पहले अध्याय बनाएं, फिर कहानी जोड़ें।' })}
          </p>
        ) : (
          <select
            className="input-field mb-4"
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            disabled={busy}
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        )}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || !selectedChapterId || chapters.length === 0}
          onClick={() => void handleAdd()}
        >
          <BilingualBtn en="Add to chapter" hi="अध्याय में जोड़ें" />
        </button>
      </Modal>

      <Modal
        open={revisionStoryId !== null}
        onClose={closeModals}
        title={t({ en: 'Request revision', hi: 'संशोधन माँगें' })}
        busy={busy}
      >
        <p className="mb-3 text-sm text-slate-600">
          {t({
            en: 'Tell the contributor what to change. They can edit and submit again.',
            hi: 'योगदानकर्ता को बताएं क्या बदलना है। वे फिर संपादित करके जमा कर सकते हैं।',
          })}
        </p>
        <textarea
          className="input-field mb-4 min-h-[100px]"
          placeholder={t({ en: 'Your notes…', hi: 'आपके नोट…' })}
          value={revisionNotes}
          onChange={(e) => setRevisionNotes(e.target.value)}
          disabled={busy}
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || !revisionNotes.trim()}
          onClick={() => void handleRequestRevision()}
        >
          <BilingualBtn en="Send request" hi="अनुरोध भेजें" />
        </button>
      </Modal>

      <Modal
        open={deleteStoryId !== null}
        onClose={closeModals}
        title={t({ en: 'Delete submission?', hi: 'जमा की गई कहानी हटाएं?' })}
        busy={busy}
      >
        <p className="mb-4 text-sm text-slate-600">
          {t({
            en: 'This removes the story from your book review queue. The contributor may still have a copy in their account.',
            hi: 'यह कहानी आपकी समीक्षा सूची से हट जाएगी। योगदानकर्ता के खाते में प्रति रह सकती है।',
          })}
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={closeModals} disabled={busy}>
            <BilingualBtn en="Cancel" hi="रद्द" />
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            <BilingualBtn en="Delete" hi="हटाएं" />
          </button>
        </div>
      </Modal>
    </section>
  );
}
