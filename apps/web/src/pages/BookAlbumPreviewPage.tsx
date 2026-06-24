import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AlbumBookViewer } from '@/components/AlbumBookViewer';
import { BilingualBtn } from '@/components/BilingualText';
import { buildAlbumPages, indexClipsByStory } from '@/lib/albumPages';
import { getOrCreateBook, getBookPreviewData } from '@/services/books';
import { userDisplayName } from '@/lib/userDisplayName';
import type { Book, Chapter, StorySession, AudioClip } from '@/types';

export function BookAlbumPreviewPage() {
  const { user, profile } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const name = userDisplayName(user, profile);
    getOrCreateBook(user.uid, name)
      .then(async (b) => {
        const data = await getBookPreviewData(b.id, user.uid);
        if (!data) {
          setError('Could not load book. / पुस्तक लोड नहीं हो सकी।');
          return;
        }
        setBook(data.book);
        setChapters(data.chapters);
        setStories(data.stories);
        setClips(data.clips);
      })
      .catch(() => setError('Could not load book. / पुस्तक लोड नहीं हो सकी।'))
      .finally(() => setLoading(false));
  }, [user, profile]);

  if (!user) return <Navigate to="/login?redirect=/book/album" replace />;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4ebe0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4ebe0] px-6 text-center">
        <p className="text-slate-700">{error || 'Book unavailable'}</p>
        <Link to="/book" className="btn-primary mt-6">
          <BilingualBtn en="Back to Book" hi="पुस्तक पर वापस" />
        </Link>
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
      backLink={{ to: '/book', label: '← Edit book / पुस्तक संपादित करें' }}
    />
  );
}
