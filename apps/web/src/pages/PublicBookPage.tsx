import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlbumBookViewer } from '@/components/AlbumBookViewer';
import { BilingualBtn } from '@/components/BilingualText';
import { buildAlbumPages, indexClipsByStory } from '@/lib/albumPages';
import { getPublishedBookData, getStoryByPublicSlug } from '@/services/books';
import type { Book, Chapter, StorySession, AudioClip } from '@/types';

export function PublicBookPage() {
  const { bookSlug, storySlug } = useParams<{ bookSlug: string; storySlug?: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookSlug) return;

    async function load() {
      setLoading(true);
      try {
        if (storySlug) {
          const data = await getStoryByPublicSlug(bookSlug, storySlug);
          if (!data) {
            setError('Story not found or book is not published. / कहानी नहीं मिली या पुस्तक प्रकाशित नहीं।');
            return;
          }
          setBook(data.book);
          setChapters([]);
          setStories([data.story]);
          setClips(data.clips as AudioClip[]);
        } else {
          const data = await getPublishedBookData(bookSlug);
          if (!data) {
            setError('Book not found or not published yet. / पुस्तक नहीं मिली या अभी प्रकाशित नहीं।');
            return;
          }
          setBook(data.book);
          setChapters(data.chapters);
          setStories(data.stories);
          setClips(data.clips);
        }
      } catch {
        setError('Failed to load book. / पुस्तक लोड करने में विफल।');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [bookSlug, storySlug]);

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
        <p className="text-lg text-slate-700">{error || 'Book unavailable / पुस्तक उपलब्ध नहीं'}</p>
        <Link to="/" className="btn-primary mt-6">
          <BilingualBtn en="Go to AATMA KATHA" hi="AATMA KATHA पर जाएं" />
        </Link>
      </div>
    );
  }

  const clipsByStory = indexClipsByStory(clips);
  const pages = buildAlbumPages(book, chapters, stories, clipsByStory, { preview: false });

  let initialPageIndex = 0;
  if (storySlug && stories[0]) {
    const idx = pages.findIndex((p) => p.kind === 'spread' && p.storyId === stories[0].id);
    if (idx >= 0) initialPageIndex = idx;
  }

  return (
    <AlbumBookViewer
      book={book}
      pages={pages}
      clipsByStory={clipsByStory}
      mode="public"
      initialPageIndex={initialPageIndex}
    />
  );
}
