import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import { AlbumBookViewer } from '@/components/AlbumBookViewer';
import { BilingualBtn } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { buildAlbumPages, indexClipsByStory, resolveSpreadPageIndex } from '@/lib/albumPages';
import { bookPublicUrl, chapterPublicUrl, storyPublicUrl } from '@/lib/slug';
import { getPublishedBookData, getStoryByPublicSlug } from '@/services/books';
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

export function PublicBookPage() {
  const t = usePickText();
  const { bookSlug, storySlug } = useParams<{ bookSlug: string; storySlug?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const contributeHubPath =
    (location.state as { fromContributeHub?: string } | null)?.fromContributeHub ?? null;
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
    if (!bookSlug) return;

    async function load() {
      setLoading(true);
      try {
        if (storySlug) {
          const data = await getStoryByPublicSlug(bookSlug, storySlug);
          if (!data) {
            setError(t({ en: 'Story not found or book is not published.', hi: 'कहानी नहीं मिली या पुस्तक प्रकाशित नहीं।' }));
            return;
          }
          setBook(data.book);
          setChapters([]);
          setStories([data.story]);
          setClips(data.clips as AudioClip[]);
        } else {
          const data = await getPublishedBookData(bookSlug);
          if (!data) {
            setError(t({ en: 'Book not found or not published yet.', hi: 'पुस्तक नहीं मिली या अभी प्रकाशित नहीं।' }));
            return;
          }
          setBook(data.book);
          setChapters(data.chapters);
          setStories(data.stories);
          setClips(data.clips);
        }
      } catch (err) {
        console.error('Failed to load public book:', err);
        setError(t({ en: 'Failed to load book.', hi: 'पुस्तक लोड करने में विफल।' }));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [bookSlug, storySlug, t]);

  const scoped = useMemo(
    () =>
      storySlug
        ? { chapters, stories, clips }
        : scopeAlbumContent(chapters, stories, clips, {
            chapterId,
            storyId: spreadStoryId,
          }),
    [storySlug, chapters, stories, clips, chapterId, spreadStoryId],
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
    if (storySlug && scoped.stories[0]?.publicSlug) {
      return storyPublicUrl(book.publicSlug, scoped.stories[0].publicSlug);
    }
    if (spreadStoryId && !chapterId) {
      const story = scoped.stories.find((s) => s.id === spreadStoryId) ?? scoped.stories[0];
      if (story?.publicSlug) return storyPublicUrl(book.publicSlug, story.publicSlug);
      return `${bookPublicUrl(book.publicSlug)}?story=${encodeURIComponent(spreadStoryId)}`;
    }
    if (chapterId) return chapterPublicUrl(book.publicSlug, chapterId);
    return bookPublicUrl(book.publicSlug);
  }, [book, storySlug, spreadStoryId, chapterId, scoped.stories]);

  const shareTitle = useMemo(() => {
    if (!book) return '';
    if (storySlug || spreadStoryId) {
      const story = scoped.stories[0];
      return story ? `${story.title} — ${book.title}` : book.title;
    }
    if (chapterId) {
      const chapter = scoped.chapters[0];
      return chapter ? `${chapter.title} — ${book.title}` : book.title;
    }
    return book.title;
  }, [book, storySlug, spreadStoryId, chapterId, scoped.stories, scoped.chapters]);

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
    storyId: spreadStoryId ?? (storySlug && scoped.stories[0] ? scoped.stories[0].id : null),
    blockId: spreadBlockId,
    page: spreadPage,
  });
  if (
    !hasExplicitPage &&
    !spreadStoryId &&
    !spreadBlockId &&
    !storySlug &&
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
      backLink={
        contributeHubPath
          ? { to: contributeHubPath, label: t({ en: '← Back to contributions', hi: '← योगदान पर वापस' }) }
          : undefined
      }
    />
  );
}
