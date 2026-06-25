import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlbumBookViewer } from '@/components/AlbumBookViewer';
import { BilingualBtn } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { buildAlbumPages, indexClipsByStory, resolveSpreadPageIndex } from '@/lib/albumPages';
import { bookPublicUrl } from '@/lib/slug';
import { getBrowsableBookData } from '@/services/books';
import type { AudioClip, Book, Chapter, StorySession } from '@/types';

function scopeAlbumContent(
  chapters: Chapter[],
  stories: StorySession[],
  clips: AudioClip[],
  options: { chapterId?: string | null; storyId?: string | null },
): { chapters: Chapter[]; stories: StorySession[]; clips: AudioClip[] } {
  const { chapterId, storyId } = options;

  if (storyId) {
    const story = stories.find((s) => s.id === storyId);
    if (!story) return { chapters: [], stories: [], clips: [] };
    return {
      chapters: [],
      stories: [story],
      clips: clips.filter((c) => c.storySessionId === story.id),
    };
  }

  if (chapterId) {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return { chapters: [], stories: [], clips: [] };
    const chapterStories = chapter.storyOrder
      .map((id) => stories.find((s) => s.id === id))
      .filter(Boolean) as StorySession[];
    const storyIds = new Set(chapterStories.map((s) => s.id));
    return {
      chapters: [chapter],
      stories: chapterStories,
      clips: clips.filter((c) => storyIds.has(c.storySessionId)),
    };
  }

  return { chapters, stories, clips };
}

export function PublicBrowsePage() {
  const t = usePickText();
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapter');
  const spreadStoryId = searchParams.get('story');
  const spreadBlockId = searchParams.get('block');
  const spreadPage = searchParams.get('page');
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getBrowsableBookData(token);
        if (!data) {
          setError(
            t({
              en: 'This browse link is invalid or has not been set up yet.',
              hi: 'यह ब्राउज़ लिंक अमान्य है या अभी सेट नहीं हुआ।',
            }),
          );
          return;
        }
        setBook(data.book);
        setChapters(data.chapters);
        setStories(data.stories);
        setClips(data.clips);
      } catch (err) {
        console.error('Failed to load browse book:', err);
        setError(t({ en: 'Failed to load book.', hi: 'पुस्तक लोड करने में विफल।' }));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token, t]);

  const scoped = useMemo(
    () =>
      scopeAlbumContent(chapters, stories, clips, {
        chapterId,
        storyId: spreadStoryId,
      }),
    [chapters, stories, clips, chapterId, spreadStoryId],
  );

  const clipsByStory = useMemo(() => indexClipsByStory(scoped.clips), [scoped.clips]);
  const pages = useMemo(
    () =>
      book
        ? buildAlbumPages(book, scoped.chapters, scoped.stories, clipsByStory, { preview: false })
        : [],
    [book, scoped.chapters, scoped.stories, clipsByStory],
  );

  const shareUrl = useMemo(() => {
    if (!book) return null;
    if (book.isPublished) return bookPublicUrl(book.publicSlug);
    return typeof window !== 'undefined' ? `${window.location.origin}/browse/${token}` : null;
  }, [book, token]);

  const shareTitle = useMemo(() => book?.title ?? '', [book]);

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
        <p className="text-lg text-slate-700">
          {error || t({ en: 'Book unavailable', hi: 'पुस्तक उपलब्ध नहीं' })}
        </p>
        <Link to="/" className="btn-primary mt-6">
          <BilingualBtn en="Go to AATMA KATHA" hi="AATMA KATHA पर जाएं" />
        </Link>
      </div>
    );
  }

  const hasExplicitPage = spreadPage !== null;
  let initialPageIndex = resolveSpreadPageIndex(pages, {
    storyId: spreadStoryId,
    blockId: spreadBlockId,
    page: spreadPage,
  });
  if (
    !hasExplicitPage &&
    !spreadStoryId &&
    !spreadBlockId &&
    chapterId &&
    scoped.chapters.length > 0
  ) {
    const chapter = scoped.chapters.find((c) => c.id === chapterId);
    if (chapter) {
      const idx = pages.findIndex((p) => p.kind === 'chapter' && p.chapterTitle === chapter.title);
      if (idx >= 0) initialPageIndex = idx;
    }
  }

  return (
    <AlbumBookViewer
      book={book}
      pages={pages}
      clipsByStory={clipsByStory}
      mode="public"
      initialPageIndex={initialPageIndex}
      shareUrl={shareUrl}
      shareTitle={shareTitle}
    />
  );
}
