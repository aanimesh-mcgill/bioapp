import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { usePickText } from '@/context/UiLocaleContext';
import { storyTimelineMs } from '@/lib/storyTimeline';
import { updateStoryTitle, deleteBookStory } from '@/services/storySessions';
import type { Book, Chapter, StorySession } from '@/types';

interface BookTocEditorProps {
  book: Book;
  chapters: Chapter[];
  stories: StorySession[];
  userId: string;
  newChapterTitle: string;
  onNewChapterTitleChange: (v: string) => void;
  onAddChapter: () => void;
  addingChapter?: boolean;
  onMoveChapter: (chapterId: string, direction: 'up' | 'down') => void;
  onMoveStoryInChapter: (chapterId: string, storyId: string, dir: 'up' | 'down') => void;
  onAssignStory: (storyId: string, chapterId: string) => void;
  onUpdateChapterTitle: (chapterId: string, title: string) => void;
}

const READY_STATUSES = ['ready', 'pending_approval', 'approved', 'transcribing', 'generating', 'recording'];

function storyOpenHref(story: StorySession): string {
  const isActive = ['recording', 'transcribing', 'generating'].includes(story.status);
  return isActive ? `/story/${story.id}` : `/stories/${story.id}`;
}

function formatStoryDate(story: StorySession): string {
  const ms = storyTimelineMs(story);
  const d = new Date(ms);
  if (story.imageStimulus?.date || story.textStimulus?.date) {
    return d.toLocaleDateString();
  }
  if (story.imageStimulus?.year || story.textStimulus?.year) {
    return String(story.imageStimulus?.year ?? story.textStimulus?.year);
  }
  return d.toLocaleDateString();
}

function ChapterIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 10l4-4M7 6h3v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M5.5 4.5V3.5h5v1M6 7v4.5M10 7v4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.5 4.5l.4 8.5h6.2l.4-8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const iconBtnClass =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50';

interface ChapterPickerState {
  storyId: string;
  currentChapterId: string | null;
  storyTitle: string;
}

function ChapterPickerModal({
  open,
  onClose,
  chapters,
  currentChapterId,
  storyTitle,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterId: string | null;
  storyTitle: string;
  onSelect: (chapterId: string) => void;
}) {
  const t = usePickText();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <div>
          <p className="font-semibold text-brand-800">
            {t({ en: 'Move to chapter', hi: 'अध्याय बदलें' })}
          </p>
          <p className="truncate text-sm font-normal text-slate-500">{storyTitle}</p>
        </div>
      }
    >
      <div className="space-y-2">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
              currentChapterId === chapter.id
                ? 'border-brand-400 bg-brand-50 font-medium text-brand-800'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => {
              onSelect(chapter.id);
              onClose();
            }}
          >
            {chapter.title}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function BookTocEditor({
  book,
  chapters,
  stories,
  userId,
  newChapterTitle,
  onNewChapterTitleChange,
  onAddChapter,
  addingChapter,
  onMoveChapter,
  onMoveStoryInChapter,
  onAssignStory,
  onUpdateChapterTitle,
}: BookTocEditorProps) {
  const t = usePickText();
  const [chapterPicker, setChapterPicker] = useState<ChapterPickerState | null>(null);
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const readyStories = stories.filter((s) => READY_STATUSES.includes(s.status));

  const assignedIds = new Set(chapters.flatMap((c) => c.storyOrder));
  const unassigned = readyStories.filter((s) => !assignedIds.has(s.id));

  const orderedChapters = book.chapterOrder
    .map((id) => chapters.find((c) => c.id === id))
    .filter(Boolean) as Chapter[];

  const deleteStory = stories.find((s) => s.id === deleteStoryId);

  const canDeleteStory = (story: StorySession) =>
    story.userId === userId || (story.bookOwnerId != null && story.bookOwnerId === userId);

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteStoryId(null);
    setDeleteError('');
  };

  const handleDeleteStory = async () => {
    if (!deleteStoryId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteBookStory(deleteStoryId, chapters);
      setDeleteStoryId(null);
      setDeleteError('');
    } catch (err) {
      console.error('delete story failed:', err);
      setDeleteError(
        t({
          en: 'Could not delete story. Try again.',
          hi: 'कहानी हटाई नहीं जा सकी। फिर कोशिश करें।',
        }),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeading en="Table of Contents" hi="विषय सूची" />
      <BilingualLine
        en="Create chapters, assign stories, and arrange order. Tap the chapter icon on a story to move it."
        hi="अध्याय बनाएं, कहानियाँ असाइन करें, क्रम व्यवस्थित करें। कहानी को दूसरे अध्याय में ले जाने के लिए अध्याय आइकन दबाएँ।"
        enClass="text-sm text-slate-600"
        hiClass="text-xs text-slate-500"
      />

      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder={t({ en: 'New chapter title', hi: 'नया अध्याय शीर्षक' })}
          value={newChapterTitle}
          onChange={(e) => onNewChapterTitleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddChapter()}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={onAddChapter}
          disabled={addingChapter || !newChapterTitle.trim()}
        >
          {addingChapter ? (
            <BilingualBtn en="Adding…" hi="जोड़ रहे…" />
          ) : (
            <BilingualBtn en="Add Chapter" hi="अध्याय जोड़ें" />
          )}
        </button>
      </div>

      {orderedChapters.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          <T en="No chapters yet — add one above." hi="अभी कोई अध्याय नहीं — ऊपर जोड़ें।" />
        </p>
      )}

      {orderedChapters.map((chapter) => {
        const chapterStories = chapter.storyOrder
          .map((id) => stories.find((s) => s.id === id))
          .filter(Boolean) as StorySession[];

        return (
          <div key={chapter.id} className="card">
            <div className="mb-2 flex items-center gap-2">
              <input
                className="input-field flex-1 font-semibold"
                defaultValue={chapter.title}
                onBlur={(e) => onUpdateChapterTitle(chapter.id, e.target.value)}
              />
              <button type="button" className="px-2 text-slate-400" onClick={() => onMoveChapter(chapter.id, 'up')} aria-label="Move chapter up">↑</button>
              <button type="button" className="px-2 text-slate-400" onClick={() => onMoveChapter(chapter.id, 'down')} aria-label="Move chapter down">↓</button>
            </div>

            {chapterStories.length === 0 ? (
              <p className="text-xs text-slate-400">
                <T en="No stories in this chapter yet." hi="इस अध्याय में अभी कोई कहानी नहीं।" />
              </p>
            ) : (
              chapterStories.map((story, idx) => (
                <div
                  key={story.id}
                  className="flex items-center gap-1.5 border-t border-slate-100 py-2 first:border-t-0"
                >
                  {story.isContributorStory && (
                    <span
                      className="hidden max-w-[4.5rem] shrink-0 truncate rounded-full bg-accent-100 px-1.5 py-0.5 text-[9px] text-accent-700 sm:inline"
                      title={`${story.contributorName} · ${story.contributorRelationship}`}
                    >
                      {story.contributorName}
                    </span>
                  )}
                  <input
                    className="input-field min-w-0 flex-1 py-1.5 text-sm"
                    defaultValue={story.title}
                    onBlur={(e) => updateStoryTitle(story.id, e.target.value)}
                    title={formatStoryDate(story)}
                  />
                  <button
                    type="button"
                    className={iconBtnClass}
                    aria-label={t({ en: 'Change chapter', hi: 'अध्याय बदलें' })}
                    onClick={() =>
                      setChapterPicker({
                        storyId: story.id,
                        currentChapterId: chapter.id,
                        storyTitle: story.title,
                      })
                    }
                  >
                    <ChapterIcon />
                  </button>
                  <button
                    type="button"
                    className="px-0.5 text-sm text-slate-400 disabled:opacity-30"
                    onClick={() => onMoveStoryInChapter(chapter.id, story.id, 'up')}
                    disabled={idx === 0}
                    aria-label={t({ en: 'Move story up', hi: 'कहानी ऊपर ले जाएँ' })}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="px-0.5 text-sm text-slate-400 disabled:opacity-30"
                    onClick={() => onMoveStoryInChapter(chapter.id, story.id, 'down')}
                    disabled={idx === chapterStories.length - 1}
                    aria-label={t({ en: 'Move story down', hi: 'कहानी नीचे ले जाएँ' })}
                  >
                    ↓
                  </button>
                  <Link
                    to={storyOpenHref(story)}
                    className={`${iconBtnClass} text-brand-600 hover:border-brand-200 hover:bg-brand-50`}
                    aria-label={
                      story.status === 'pending_approval'
                        ? t({ en: 'Review story', hi: 'कहानी की समीक्षा करें' })
                        : t({ en: 'Open story', hi: 'कहानी खोलें' })
                    }
                  >
                    <OpenIcon />
                  </Link>
                  {canDeleteStory(story) && (
                    <button
                      type="button"
                      className={`${iconBtnClass} text-red-500 hover:border-red-200 hover:bg-red-50`}
                      aria-label={t({ en: 'Delete story', hi: 'कहानी हटाएं' })}
                      onClick={() => setDeleteStoryId(story.id)}
                    >
                      <DeleteIcon />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <section>
          <SectionHeading en="Unassigned Stories" hi="असाइन न की गई कहानियाँ" />
          <BilingualLine
            en="These stories are not in any chapter yet. Pick a chapter for each."
            hi="ये कहानियाँ अभी किसी अध्याय में नहीं हैं। प्रत्येक के लिए अध्याय चुनें।"
            enClass="mb-3 text-xs text-slate-500"
            hiClass="mb-3 text-xs text-slate-400"
          />
          <div className="space-y-2">
            {unassigned.map((story) => (
              <div key={story.id} className="card flex items-center gap-1.5 py-2.5">
                <div className="min-w-0 flex-1 truncate">
                  <Link
                    to={storyOpenHref(story)}
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    {story.title}
                  </Link>
                  <p className="truncate text-[10px] text-slate-400">
                    {formatStoryDate(story)} · {story.status.replace('_', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  className={iconBtnClass}
                  aria-label={t({ en: 'Assign to chapter', hi: 'अध्याय चुनें' })}
                  onClick={() =>
                    setChapterPicker({
                      storyId: story.id,
                      currentChapterId: null,
                      storyTitle: story.title,
                    })
                  }
                >
                  <ChapterIcon />
                </button>
                <Link
                  to={storyOpenHref(story)}
                  className={`${iconBtnClass} text-brand-600 hover:border-brand-200 hover:bg-brand-50`}
                  aria-label={t({ en: 'Open story', hi: 'कहानी खोलें' })}
                >
                  <OpenIcon />
                </Link>
                {canDeleteStory(story) && (
                  <button
                    type="button"
                    className={`${iconBtnClass} text-red-500 hover:border-red-200 hover:bg-red-50`}
                    aria-label={t({ en: 'Delete story', hi: 'कहानी हटाएं' })}
                    onClick={() => setDeleteStoryId(story.id)}
                  >
                    <DeleteIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <ChapterPickerModal
        open={chapterPicker != null}
        onClose={() => setChapterPicker(null)}
        chapters={orderedChapters}
        currentChapterId={chapterPicker?.currentChapterId ?? null}
        storyTitle={chapterPicker?.storyTitle ?? ''}
        onSelect={(chapterId) => {
          if (chapterPicker && chapterId !== chapterPicker.currentChapterId) {
            onAssignStory(chapterPicker.storyId, chapterId);
          }
        }}
      />

      <Modal
        open={deleteStoryId !== null}
        onClose={closeDeleteModal}
        title={t({ en: 'Delete story?', hi: 'कहानी हटाएं?' })}
        busy={deleting}
      >
        <p className="mb-4 text-sm text-slate-600">
          {deleteStory ? (
            <>
              <span className="font-medium text-heritage-ink">{deleteStory.title}</span>
              {' — '}
            </>
          ) : null}
          {t({
            en: 'This permanently removes the story, recordings, and photos. This cannot be undone.',
            hi: 'यह कहानी, रिकॉर्डिंग और फोटो स्थायी रूप से हटा देगा। इसे वापस नहीं लाया जा सकता।',
          })}
        </p>
        {deleteError && <p className="mb-3 text-sm text-red-600">{deleteError}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={closeDeleteModal}
            disabled={deleting}
          >
            <BilingualBtn en="Cancel" hi="रद्द" />
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
            disabled={deleting}
            onClick={() => void handleDeleteStory()}
          >
            <BilingualBtn en="Delete" hi="हटाएं" />
          </button>
        </div>
      </Modal>
    </div>
  );
}
