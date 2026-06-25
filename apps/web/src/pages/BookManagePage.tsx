import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BilingualBtn, T } from '@/components/BilingualText';
import { BookTocEditor } from '@/components/BookTocEditor';
import { BookSharingSections } from '@/components/book-sharing/BookSharingSections';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { subscribeToContributorSubmissions, subscribeToSessions } from '@/services/storySessions';
import { contributorStoryMatchesBook } from '@/lib/contributorStories';
import {
  getOrCreateAlbumBookForCollab,
  subscribeToBook,
  subscribeToChapters,
  createChapter,
  reorderChapters,
  reorderStoriesInChapter,
  moveStoryToChapter,
  updateBookTitle,
  updateChapterTitle,
} from '@/services/books';
import { updateBookMetadata } from '@/services/booksCollaboration';
import { storyBelongsToCollabBook } from '@/services/bookStructure';
import { userDisplayName } from '@/lib/userDisplayName';
import type { Book, Chapter, StorySession } from '@/types';

type BookTab = 'contents' | 'share';

export function BookManagePage() {
  const { user, profile } = useAuth();
  const { activeBook, loading: bookContextLoading } = useBook();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'share' ? 'share' : 'contents';
  const [tab, setTab] = useState<BookTab>(initialTab);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [contributorSessions, setContributorSessions] = useState<StorySession[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const bookStories = useMemo(() => {
    if (!activeBook || !book) return [];
    const byId = new Map<string, StorySession>();
    for (const s of stories) {
      if (storyBelongsToCollabBook(s, activeBook.id, book.id)) {
        byId.set(s.id, s);
      }
    }
    for (const s of contributorSessions) {
      if (contributorStoryMatchesBook(s, activeBook.id, book.id)) {
        byId.set(s.id, s);
      }
    }
    return Array.from(byId.values());
  }, [stories, contributorSessions, activeBook, book]);

  const storiesById = useMemo(() => new Map(bookStories.map((s) => [s.id, s])), [bookStories]);

  const bookId = book?.id;
  const userId = user?.uid;

  useEffect(() => {
    const next = searchParams.get('tab') === 'share' ? 'share' : 'contents';
    setTab(next);
  }, [searchParams]);

  useEffect(() => {
    if (!user || !activeBook) {
      if (!bookContextLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    const name = userDisplayName(user, profile);
    getOrCreateAlbumBookForCollab(user.uid, activeBook, name)
      .then((b) => {
        setBook(b);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadError('Could not load book.');
        setLoading(false);
      });
  }, [user, profile, activeBook?.id, activeBook?.title, bookContextLoading]);

  useEffect(() => {
    if (!bookId) return;
    return subscribeToBook(bookId, setBook);
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !userId) return;
    return subscribeToChapters(bookId, userId, setChapters);
  }, [bookId, userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToSessions(userId, setStories);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToContributorSubmissions(userId, setContributorSessions);
  }, [userId]);

  const handleAddChapter = async () => {
    if (!book || !user || !newChapterTitle.trim()) return;
    setAddingChapter(true);
    try {
      await createChapter(book.id, user.uid, newChapterTitle.trim());
      setNewChapterTitle('');
    } finally {
      setAddingChapter(false);
    }
  };

  const handleAssignStory = async (storyId: string, toChapterId: string) => {
    const story = bookStories.find((s) => s.id === storyId);
    await moveStoryToChapter(storyId, story?.chapterId ?? null, toChapterId, storiesById, true);
  };

  const handleMoveChapter = async (chapterId: string, direction: 'up' | 'down') => {
    if (!book) return;
    const order = [...book.chapterOrder];
    const idx = order.indexOf(chapterId);
    if (direction === 'up' && idx > 0) [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    else if (direction === 'down' && idx < order.length - 1) [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    else return;
    await reorderChapters(book.id, order);
  };

  const handleMoveStoryInChapter = async (chapterId: string, storyId: string, dir: 'up' | 'down') => {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const order = [...chapter.storyOrder];
    const idx = order.indexOf(storyId);
    if (dir === 'up' && idx > 0) [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    else if (dir === 'down' && idx < order.length - 1) [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    else return;
    await reorderStoriesInChapter(chapterId, order);
  };

  const handleTitleBlur = async () => {
    if (!book || !user || !activeBook) return;
    const title = book.title.trim();
    if (!title) return;
    await updateBookTitle(book.id, title);
    if (title !== activeBook.title) {
      await updateBookMetadata(activeBook.id, user.uid, { title });
    }
  };

  if (loading || bookContextLoading) {
    return (
      <div className="heritage-page flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!activeBook) {
    return (
      <div className="heritage-page flex min-h-[40vh] flex-col items-center justify-center text-center">
        <HeritagePageTitle en="Book" hi="पुस्तक" />
        <Link to="/books" className="btn-primary">
          <BilingualBtn en="Choose a book" hi="पुस्तक चुनें" />
        </Link>
      </div>
    );
  }

  if (loadError || !book) {
    return (
      <div className="heritage-page flex min-h-[40vh] items-center justify-center text-center">
        <p className="text-heritage-muted">{loadError || <T en="Book unavailable" hi="पुस्तक उपलब्ध नहीं" />}</p>
      </div>
    );
  }

  return (
    <div className="heritage-page">
      <HeritagePageTitle
        en="Table of contents"
        hi="विषय सूची"
        subtitle={{ en: activeBook.title, hi: activeBook.title }}
      />

      <p className={`mb-4 text-xs text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
        {chapters.length} {t({ en: 'chapters', hi: 'अध्याय' })} · {bookStories.length}{' '}
        {t({ en: 'stories', hi: 'कहानियाँ' })}
      </p>

      <div className="mb-6 flex gap-2">
        {(
          [
            ['contents', { en: 'Contents', hi: 'विषय सूची' }],
            ['share', { en: 'Share & invite', hi: 'साझा करें' }],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              tab === id ? 'bg-brand-600 text-white' : 'bg-heritage-paper text-heritage-muted ring-1 ring-heritage-line'
            } ${locale === 'hi' && tab === id ? 'font-hindi' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <Link
        to="/book/album"
        className="card mb-6 flex items-center gap-3 py-3 transition active:scale-[0.99]"
      >
        <span className="text-2xl">📖</span>
        <div className="flex-1">
          <p className="font-medium text-heritage-ink">{t({ en: 'Preview album', hi: 'एल्बम देखें' })}</p>
          <p className="text-xs text-heritage-muted">
            {t({ en: 'Read-only spread view', hi: 'केवल पढ़ने का दृश्य' })}
          </p>
        </div>
        <span className="text-brand-600">→</span>
      </Link>

      {tab === 'share' && activeBook && (
        <>
          <div className="card mb-4">
            <input
              className="input-field mb-1 font-serif text-lg"
              value={book.title}
              onChange={(e) => setBook({ ...book, title: e.target.value })}
              onBlur={handleTitleBlur}
            />
            <p className={`text-xs text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
              {t({ en: `by ${book.authorName}`, hi: `द्वारा ${book.authorName}` })}
            </p>
          </div>
          <BookSharingSections
            collabBook={activeBook}
            albumBook={book}
            onAlbumBookChange={setBook}
          />
        </>
      )}

      {tab === 'contents' && book && user && (
        <BookTocEditor
          book={book}
          chapters={chapters}
          stories={bookStories}
          userId={user.uid}
          newChapterTitle={newChapterTitle}
          onNewChapterTitleChange={setNewChapterTitle}
          onAddChapter={handleAddChapter}
          addingChapter={addingChapter}
          onMoveChapter={handleMoveChapter}
          onMoveStoryInChapter={handleMoveStoryInChapter}
          onAssignStory={handleAssignStory}
          onUpdateChapterTitle={updateChapterTitle}
        />
      )}
    </div>
  );
}
