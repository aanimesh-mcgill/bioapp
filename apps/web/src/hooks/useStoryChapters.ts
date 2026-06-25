import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText } from '@/context/UiLocaleContext';
import { userDisplayName } from '@/lib/userDisplayName';
import { getOrCreateAlbumBookForCollab, moveStoryToChapter, subscribeToChapters } from '@/services/books';
import type { Chapter, StorySession } from '@/types';

export function useStoryChapters(session: StorySession | null) {
  const { user, profile } = useAuth();
  const { activeBook, loading: bookLoading } = useBook();
  const t = usePickText();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!user || !activeBook) {
      setChapters([]);
      return;
    }

    setLoadingChapters(true);
    let unsub = () => {};
    const authorName = userDisplayName(user, profile);

    getOrCreateAlbumBookForCollab(user.uid, activeBook, authorName)
      .then((album) => {
        unsub = subscribeToChapters(album.id, user.uid, (next) => {
          setChapters(next);
          setLoadingChapters(false);
        });
      })
      .catch(() => setLoadingChapters(false));

    return () => unsub();
  }, [user, profile, activeBook?.id, activeBook?.title]);

  const orderedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters],
  );

  const currentChapter = session?.chapterId
    ? chapters.find((c) => c.id === session.chapterId)
    : null;

  const chapterLabel = currentChapter?.title ?? t({ en: 'Unassigned', hi: 'अनियत' });

  const moveToChapter = async (toChapterId: string) => {
    if (!session || !toChapterId || toChapterId === session.chapterId) return;
    setMoving(true);
    try {
      const storiesById = new Map([[session.id, session]]);
      await moveStoryToChapter(
        session.id,
        session.chapterId ?? null,
        toChapterId,
        storiesById,
        true,
      );
    } finally {
      setMoving(false);
    }
  };

  return {
    chapters: orderedChapters,
    currentChapterId: session?.chapterId ?? '',
    chapterLabel,
    loading: bookLoading || loadingChapters,
    moving,
    moveToChapter,
    hasBook: !!activeBook,
  };
}
