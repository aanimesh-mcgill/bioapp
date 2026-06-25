import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { BilingualBtn, T } from '@/components/BilingualText';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { ShareLinkModal } from '@/components/ShareLinkModal';
import { Modal } from '@/components/ui/Modal';
import { NewStoryModal } from '@/components/story-workspace/NewStoryModal';
import { useAlbumShare } from '@/hooks/useAlbumShare';
import { resolveStoryBlocks, storyClipCount } from '@/lib/storyBlocks';
import { createChapterForCollabBook, collectBookStories } from '@/services/bookStructure';
import { getOrCreateAlbumBookForCollab, moveStoryToChapter, subscribeToChapters, updateChapterTitle } from '@/services/books';
import { ChapterPickerModal } from '@/components/ChapterPickerModal';
import { subscribeToContributorSubmissions, subscribeToSessions, deleteBookStory } from '@/services/storySessions';
import { contributorStoryMatchesBook, isContributorStorySubmitted } from '@/lib/contributorStories';
import { BookContributorSubmissionsSection } from '@/components/contributor/BookContributorSubmissionsSection';
import { userDisplayName } from '@/lib/userDisplayName';
import type { Chapter, StorySession } from '@/types';

function storyOpenHref(story: StorySession): string {
  const active = ['recording', 'transcribing', 'generating'].includes(story.status);
  return active ? `/story/${story.id}` : `/stories/${story.id}`;
}

function storyThumb(story: StorySession): string | null {
  const { order, blocks } = resolveStoryBlocks(story);
  for (const id of order) {
    const b = blocks[id];
    if (b?.type === 'image' && b.imageUrl) return b.imageUrl;
  }
  return story.imageStimulus?.imageUrl ?? null;
}

function storyMeta(story: StorySession, t: ReturnType<typeof usePickText>): string {
  const clipCount = storyClipCount(story);
  const photoCount = resolveStoryBlocks(story).order.filter(
    (id) => resolveStoryBlocks(story).blocks[id]?.type === 'image',
  ).length;
  const parts: string[] = [];
  if (clipCount > 0) {
    parts.push(`${clipCount} ${t({ en: clipCount === 1 ? 'clip' : 'clips', hi: 'क्लिप' })}`);
  }
  if (photoCount > 0) {
    parts.push(`${photoCount} ${t({ en: 'photo', hi: 'फोटो' })}`);
  }
  parts.push(story.updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  return parts.join(' · ');
}

function HeritageStoryRow({
  story,
  t,
  shareUrl,
  shareTitle,
  canDelete,
  onDelete,
  onAssignChapter,
}: {
  story: StorySession;
  t: ReturnType<typeof usePickText>;
  shareUrl: string | null;
  shareTitle: string;
  canDelete?: boolean;
  onDelete?: () => void;
  onAssignChapter?: () => void;
}) {
  const thumb = storyThumb(story);
  const isDraft = ['recording', 'transcribing', 'generating', 'ready'].includes(story.status);

  return (
    <div className="flex items-center gap-1 border-b border-heritage-line/60 py-3 last:border-0">
      <Link to={storyOpenHref(story)} className="flex min-w-0 flex-1 items-center gap-3">
        {thumb ? (
          <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-white" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-heritage-line/60 text-lg">
            📖
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-heritage-ink">{story.title}</p>
            {isDraft && (
              <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                {t({ en: 'Draft', hi: 'ड्राफ्ट' })}
              </span>
            )}
          </div>
          <p className="text-xs text-heritage-muted">{storyMeta(story, t)}</p>
        </div>
        <span className="text-heritage-muted">→</span>
      </Link>
      {onAssignChapter && (
        <button
          type="button"
          className="shrink-0 rounded-lg border border-brand-200 px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          aria-label={t({ en: 'Choose chapter', hi: 'अध्याय चुनें' })}
          onClick={onAssignChapter}
        >
          <BilingualBtn en="Chapter" hi="अध्याय" />
        </button>
      )}
      <ShareLinkModal
        url={shareUrl}
        title={shareTitle}
        ariaLabel={t({ en: 'Share story', hi: 'कहानी साझा करें' })}
        previewHint={{
          en: 'Opens an album with only this story.',
          hi: 'केवल इस कहानी का एल्बम खुलता है।',
        }}
      />
      {canDelete && onDelete && (
        <button
          type="button"
          className="shrink-0 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          aria-label={t({ en: 'Delete story', hi: 'कहानी हटाएं' })}
          onClick={onDelete}
        >
          <BilingualBtn en="Delete" hi="हटाएं" />
        </button>
      )}
    </div>
  );
}

export function StoriesPage() {
  const { user, profile } = useAuth();
  const { activeBook, loading: bookLoading } = useBook();
  const t = usePickText();
  const { locale } = useUiLocale();
  const { storyUrl, chapterUrl, shareTitle } = useAlbumShare();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('session');

  const [allSessions, setAllSessions] = useState<StorySession[]>([]);
  const [contributorSessions, setContributorSessions] = useState<StorySession[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [albumBookId, setAlbumBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());
  const [showNewStory, setShowNewStory] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [chapterPicker, setChapterPicker] = useState<{
    storyId: string;
    storyTitle: string;
    currentChapterId: string | null;
  } | null>(null);
  const [assigningChapter, setAssigningChapter] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToSessions(user.uid, setAllSessions);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToContributorSubmissions(user.uid, setContributorSessions);
  }, [user]);

  useEffect(() => {
    if (!user || !activeBook) {
      setChapters([]);
      setAlbumBookId(null);
      if (!bookLoading) setLoading(false);
      return;
    }

    setLoading(true);
    const authorName = userDisplayName(user, profile);
    let unsubChapters = () => undefined;

    getOrCreateAlbumBookForCollab(user.uid, activeBook, authorName)
      .then((album) => {
        setAlbumBookId(album.id);
        unsubChapters = subscribeToChapters(album.id, user.uid, setChapters);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => unsubChapters();
  }, [user, profile, activeBook?.id, activeBook?.title, bookLoading]);

  const bookStories = useMemo(() => {
    if (!activeBook) return [];
    const byId = new Map<string, StorySession>();
    for (const s of collectBookStories(allSessions, activeBook.id, albumBookId, chapters)) {
      byId.set(s.id, s);
    }
    for (const s of contributorSessions) {
      if (contributorStoryMatchesBook(s, activeBook.id, albumBookId)) {
        byId.set(s.id, s);
      }
    }
    return Array.from(byId.values());
  }, [allSessions, contributorSessions, activeBook, albumBookId, chapters]);

  const isBookOwner = Boolean(user && activeBook && activeBook.ownerId === user.uid);

  const canDeleteStory = (story: StorySession) =>
    Boolean(
      user &&
        (story.userId === user.uid ||
          isBookOwner ||
          (story.bookOwnerId != null && story.bookOwnerId === user.uid)),
    );

  const storiesById = useMemo(() => new Map(bookStories.map((s) => [s.id, s])), [bookStories]);

  const deleteStory = storiesById.get(deleteStoryId ?? '');

  const { chapterStories, unassignedStories, contributorStories } = useMemo(() => {
    const assigned = new Set<string>();
    const byChapter = new Map<string, StorySession[]>();

    for (const chapter of chapters) {
      const list = chapter.storyOrder
        .map((id) => storiesById.get(id))
        .filter(Boolean) as StorySession[];
      list.forEach((s) => assigned.add(s.id));
      byChapter.set(chapter.id, list);
    }

    const unassigned = bookStories
      .filter((s) => !assigned.has(s.id) && !s.isContributorStory)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    const contributors = bookStories.filter(
      (s) =>
        s.isContributorStory &&
        !assigned.has(s.id) &&
        isContributorStorySubmitted(s),
    );

    return { chapterStories: byChapter, unassignedStories: unassigned, contributorStories: contributors };
  }, [chapters, bookStories, storiesById]);

  useEffect(() => {
    if (chapters.length > 0 && expandedChapterIds.size === 0) {
      setExpandedChapterIds(new Set(chapters.map((c) => c.id)));
    }
  }, [chapters]);

  const toggleChapter = (id: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddChapter = async () => {
    if (!user || !activeBook || !newChapterTitle.trim()) return;
    setAddingChapter(true);
    try {
      await createChapterForCollabBook(
        user.uid,
        activeBook,
        userDisplayName(user, profile),
        newChapterTitle.trim(),
      );
      setNewChapterTitle('');
      setShowAddChapter(false);
    } finally {
      setAddingChapter(false);
    }
  };

  const handleAssignStory = async (storyId: string, chapterId: string) => {
    const story = storiesById.get(storyId);
    if (!story) return;
    setAssigningChapter(true);
    try {
      await moveStoryToChapter(storyId, story.chapterId ?? null, chapterId, storiesById, true);
      setChapterPicker(null);
    } finally {
      setAssigningChapter(false);
    }
  };

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
    } catch {
      setDeleteError(t({ en: 'Could not delete story.', hi: 'कहानी हटाई नहीं जा सकी।' }));
    } finally {
      setDeleting(false);
    }
  };

  if (bookLoading || loading) {
    return (
      <div className="heritage-page flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!activeBook) {
    return (
      <div className="heritage-page flex min-h-[40vh] flex-col items-center justify-center text-center">
        <HeritagePageTitle en="Your stories" hi="आपकी कहानियाँ" />
        <Link to="/books" className="btn-primary">
          <BilingualBtn en="Choose a book" hi="पुस्तक चुनें" />
        </Link>
      </div>
    );
  }

  const totalStories = bookStories.length;

  return (
    <div className="heritage-page">
      <NewStoryModal open={showNewStory} onClose={() => setShowNewStory(false)} />

      <ChapterPickerModal
        open={chapterPicker !== null}
        onClose={() => !assigningChapter && setChapterPicker(null)}
        chapters={chapters}
        currentChapterId={chapterPicker?.currentChapterId}
        storyTitle={chapterPicker?.storyTitle ?? ''}
        onSelect={(chapterId) => {
          if (chapterPicker) void handleAssignStory(chapterPicker.storyId, chapterId);
        }}
      />

      <Modal
        open={showAddChapter}
        onClose={() => !addingChapter && setShowAddChapter(false)}
        title={t({ en: 'New chapter', hi: 'नया अध्याय' })}
        busy={addingChapter}
      >
        <input
          className="input-field mb-4"
          placeholder={t({ en: 'Chapter title', hi: 'अध्याय शीर्षक' })}
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          disabled={addingChapter}
        />
        <button
          type="button"
          className="btn-primary w-full"
          onClick={handleAddChapter}
          disabled={addingChapter || !newChapterTitle.trim()}
        >
          <BilingualBtn en="Add chapter" hi="अध्याय जोड़ें" />
        </button>
      </Modal>

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
          <button type="button" className="btn-secondary flex-1" onClick={closeDeleteModal} disabled={deleting}>
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

      <div className="mb-6 flex items-start justify-between gap-3">
        <HeritagePageTitle
          en="Your stories"
          hi="आपकी कहानियाँ"
          subtitle={{ en: activeBook.title, hi: activeBook.title }}
        />
        <Link to="/book?tab=share" className="btn-secondary shrink-0 px-3 py-2 text-xs">
          {t({ en: 'Share book', hi: 'पुस्तक साझा' })}
        </Link>
      </div>

      {isBookOwner && (
        <BookContributorSubmissionsSection
          stories={contributorStories}
          chapters={chapters}
          albumBookId={albumBookId}
        />
      )}

      <div className="mb-4 flex gap-2">
        <button type="button" className="btn-primary flex-1 text-sm" onClick={() => setShowNewStory(true)}>
          <BilingualBtn en="+ New story" hi="+ नई कहानी" />
        </button>
      </div>

      {totalStories === 0 && chapters.length === 0 ? (
        <div className="card py-10 text-center">
          <span className="mb-3 block text-4xl">📖</span>
          <p className={`text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({ en: 'No stories yet. Start from Home or Prompts.', hi: 'अभी कोई कहानी नहीं। होम या प्रश्न से शुरू करें।' })}
          </p>
          <Link to="/" className="btn-primary mt-4 inline-block">
            <BilingualBtn en="Go to Home" hi="होम पर जाएं" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, chIndex) => {
            const stories = chapterStories.get(chapter.id) ?? [];
            const open = expandedChapterIds.has(chapter.id) || chapters.length === 1;

            return (
              <div key={chapter.id} className="card overflow-hidden p-0">
                <div className="flex items-center gap-1 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => toggleChapter(chapter.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="heritage-label text-brand-600">
                        {t({ en: `Chapter ${String(chIndex + 1).padStart(2, '0')}`, hi: `अध्याय ${chIndex + 1}` })}
                      </p>
                      <input
                        className="w-full bg-transparent font-serif text-lg text-heritage-ink focus:outline-none"
                        defaultValue={chapter.title}
                        aria-label={t({ en: 'Chapter title', hi: 'अध्याय शीर्षक' })}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onBlur={(e) => {
                          const title = e.target.value.trim();
                          if (title && title !== chapter.title) {
                            void updateChapterTitle(chapter.id, title);
                          }
                        }}
                      />
                    </div>
                    <span className="text-heritage-muted">{open ? '▾' : '▸'}</span>
                  </button>
                  <ShareLinkModal
                    url={chapterUrl(chapter)}
                    title={shareTitle(chapter.title)}
                    ariaLabel={t({ en: 'Share chapter', hi: 'अध्याय साझा करें' })}
                    previewHint={{
                      en: 'Opens an album with all stories in this chapter.',
                      hi: 'इस अध्याय की सभी कहानियों का एल्बम खुलता है।',
                    }}
                  />
                </div>

                {open && (
                  <div className="border-t border-heritage-line/60 px-4 pb-2">
                    {stories.length === 0 ? (
                      <p className="py-4 text-center text-xs text-heritage-muted">
                        <T en="No stories in this chapter" hi="इस अध्याय में कोई कहानी नहीं" />
                      </p>
                    ) : (
                      stories.map((s) => (
                        <div key={s.id} className={s.id === highlightId ? 'rounded-lg ring-2 ring-brand-400' : ''}>
                          <HeritageStoryRow
                            story={s}
                            t={t}
                            shareUrl={storyUrl(s)}
                            shareTitle={shareTitle(s.title)}
                            canDelete={canDeleteStory(s)}
                            onDelete={() => {
                              setDeleteStoryId(s.id);
                              setDeleteError('');
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {unassignedStories.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3">
                <p className="heritage-label">{t({ en: 'Unassigned', hi: 'अनियत' })}</p>
                <p className="mt-1 text-xs text-heritage-muted">
                  {t({
                    en: 'New stories land here. Tap Chapter to file one.',
                    hi: 'नई कहानियाँ यहाँ आती हैं। अध्याय में रखने के लिए अध्याय टैप करें।',
                  })}
                </p>
              </div>
              <div className="border-t border-heritage-line/60 px-4 pb-2">
                {unassignedStories.map((s) => (
                  <div key={s.id} className={s.id === highlightId ? 'rounded-lg ring-2 ring-brand-400' : ''}>
                    <HeritageStoryRow
                      story={s}
                      t={t}
                      shareUrl={storyUrl(s)}
                      shareTitle={shareTitle(s.title)}
                      canDelete={canDeleteStory(s)}
                      onAssignChapter={
                        chapters.length > 0
                          ? () =>
                              setChapterPicker({
                                storyId: s.id,
                                storyTitle: s.title,
                                currentChapterId: s.chapterId ?? null,
                              })
                          : undefined
                      }
                      onDelete={() => {
                        setDeleteStoryId(s.id);
                        setDeleteError('');
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
