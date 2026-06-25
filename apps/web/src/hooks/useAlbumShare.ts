import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { bookPublicUrl, chapterPublicUrl, storyPublicUrl } from '@/lib/slug';
import { userDisplayName } from '@/lib/userDisplayName';
import { getOrCreateAlbumBookForCollab } from '@/services/books';
import type { Book, Chapter, StorySession } from '@/types';

export function useAlbumShare() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const [albumBook, setAlbumBook] = useState<Book | null>(null);

  useEffect(() => {
    if (!user || !activeBook) {
      setAlbumBook(null);
      return;
    }
    const authorName = userDisplayName(user, profile);
    getOrCreateAlbumBookForCollab(user.uid, activeBook, authorName)
      .then(setAlbumBook)
      .catch(() => setAlbumBook(null));
  }, [user, profile, activeBook?.id, activeBook?.title]);

  const canShare = Boolean(albumBook?.isPublished);

  const bookUrl = canShare && albumBook ? bookPublicUrl(albumBook.publicSlug) : null;

  const storyUrl = (story: Pick<StorySession, 'publicSlug' | 'title' | 'id'>) => {
    if (!canShare || !albumBook?.publicSlug) return null;
    if (story.publicSlug) return storyPublicUrl(albumBook.publicSlug, story.publicSlug);
    return `${bookPublicUrl(albumBook.publicSlug)}?story=${encodeURIComponent(story.id)}`;
  };

  const chapterUrl = (chapter: Pick<Chapter, 'id' | 'title'>) => {
    if (!canShare || !albumBook?.publicSlug) return null;
    return chapterPublicUrl(albumBook.publicSlug, chapter.id);
  };

  const shareTitle = (label: string) => {
    const bookTitle = albumBook?.title ?? activeBook?.title ?? 'AATMA KATHA';
    return `${label} — ${bookTitle}`;
  };

  return {
    albumBook,
    canShare,
    bookUrl,
    bookShareTitle: shareTitle(albumBook?.title ?? activeBook?.title ?? 'Book'),
    storyUrl,
    chapterUrl,
    shareTitle,
  };
}
