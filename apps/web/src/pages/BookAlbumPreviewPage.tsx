import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { AlbumBookViewer } from '@/components/AlbumBookViewer';
import { BilingualBtn, T } from '@/components/BilingualText';
import { buildAlbumPages, indexClipsByStory } from '@/lib/albumPages';
import { getOrCreateAlbumBookForCollab, getBookPreviewData } from '@/services/books';
import { userDisplayName } from '@/lib/userDisplayName';
import type { Book, Chapter, StorySession, AudioClip } from '@/types';

export function BookAlbumPreviewPage() {
  const { user, profile } = useAuth();
  const { activeBook, loading: bookContextLoading } = useBook();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !activeBook) {
      if (!bookContextLoading) setLoading(false);
      return;
    }
    setLoading(true);
    const name = userDisplayName(user, profile);
    getOrCreateAlbumBookForCollab(user.uid, activeBook, name)
      .then(async (b) => {
        const data = await getBookPreviewData(b.id, user.uid);
        if (!data) {
          setError('Could not load book.');
          return;
        }
        setBook(data.book);
        setChapters(data.chapters);
        setStories(data.stories);
        setClips(data.clips);
      })
      .catch(() => setError('Could not load book.'))
      .finally(() => setLoading(false));
  }, [user, profile, activeBook?.id, activeBook?.title, bookContextLoading]);

  if (!user) return <Navigate to="/login?redirect=/book/album" replace />;

  if (loading || bookContextLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!activeBook) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="mb-4 text-slate-600">
          <T en="Select a book first." hi="पहले पुस्तक चुनें।" />
        </p>
        <Link to="/books" className="btn-primary">
          <BilingualBtn en="Go to Books" hi="पुस्तकें पर जाएं" />
        </Link>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="px-4 py-6 text-center text-slate-600">
        {error || <T en="Could not load album." hi="एल्बम लोड नहीं हो सकी।" />}
      </div>
    );
  }

  const clipsByStory = indexClipsByStory(clips);
  const pages = buildAlbumPages(book, chapters, stories, clipsByStory, { preview: true });

  return (
    <AlbumBookViewer
      book={book}
      pages={pages}
      clipsByStory={clipsByStory}
      mode="preview"
      backLink={{ to: '/book', label: '← Book settings' }}
    />
  );
}
