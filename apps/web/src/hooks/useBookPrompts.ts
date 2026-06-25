import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import {
  ensureDefaultBookPrompts,
  migrateLegacyAutobiographyProgress,
  subscribeToBookPrompts,
  subscribeToPromptProgress,
} from '@/services/bookPrompts';
import { effectiveSkippedTurnIds } from '@/lib/homeTurnQueue';
import type { BookPrompt, BookPromptProgress } from '@/types';

export function useBookPrompts() {
  const { user, profile } = useAuth();
  const { activeBook, loading: bookLoading } = useBook();
  const [prompts, setPrompts] = useState<BookPrompt[]>([]);
  const [progress, setProgress] = useState<BookPromptProgress>({
    completedPromptIds: [],
    skippedPromptIds: [],
    skippedPhotoIds: [],
    updatedAt: new Date(),
  });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const bookId = activeBook?.id;
  const userId = user?.uid;

  useEffect(() => {
    if (!bookId || !userId || bookLoading) {
      setPrompts([]);
      setProgress({ completedPromptIds: [], skippedPromptIds: [], skippedPhotoIds: [], updatedAt: new Date() });
      setLoading(!bookLoading);
      setReady(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReady(false);

    void (async () => {
      try {
        await ensureDefaultBookPrompts(bookId, activeBook!.title, userId);
        const legacy = profile?.stimulusProgress?.completedStimulusIds ?? [];
        if (legacy.length > 0) {
          await migrateLegacyAutobiographyProgress(bookId, userId, legacy);
        }
      } catch (err) {
        console.error(err);
      }
      if (!cancelled) setReady(true);
    })();

    const unsubPrompts = subscribeToBookPrompts(bookId, (next) => {
      if (!cancelled) {
        setPrompts(next);
        setLoading(false);
      }
    });
    const unsubProgress = subscribeToPromptProgress(bookId, userId, (next) => {
      if (!cancelled) setProgress(next);
    });

    return () => {
      cancelled = true;
      unsubPrompts();
      unsubProgress();
    };
  }, [bookId, userId, activeBook?.title, bookLoading, profile?.stimulusProgress?.completedStimulusIds]);

  return {
    prompts,
    completedIds: progress.completedPromptIds,
    skippedIds: progress.skippedPromptIds ?? [],
    skippedPhotoIds: progress.skippedPhotoIds ?? [],
    skippedTurnIds: effectiveSkippedTurnIds(progress),
    loading: loading || bookLoading,
    ready,
    activeBook,
    bookId,
    userId,
  };
}
