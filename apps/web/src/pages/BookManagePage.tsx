import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading, BilingualLine, BilingualBtn, SectionHeading } from '@/components/BilingualText';
import { BookTocEditor } from '@/components/BookTocEditor';
import { useAuth } from '@/context/AuthContext';
import { subscribeToSessions } from '@/services/storySessions';
import {
  getOrCreateBook,
  subscribeToBook,
  subscribeToChapters,
  createChapter,
  reorderChapters,
  reorderStoriesInChapter,
  moveStoryToChapter,
  autoSortChapterStories,
  publishBook,
  updateBookTitle,
  updateChapterTitle,
} from '@/services/books';
import {
  createContributorInvite,
  subscribeToInvites,
  deactivateInvite,
  getInviteLink,
} from '@/services/invites';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { bookPublicUrl } from '@/lib/slug';
import { userDisplayName } from '@/lib/userDisplayName';
import type { Book, Chapter, StorySession, ContributorInvite } from '@/types';

const RELATIONSHIP_SUGGESTIONS = [
  'Mother', 'Father', 'Son', 'Daughter', 'Spouse', 'Sibling',
  'Grandparent', 'Friend', 'Colleague', 'Neighbor', 'Other',
];

type BookTab = 'settings' | 'toc';

export function BookManagePage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<BookTab>('settings');
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [invites, setInvites] = useState<ContributorInvite[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const [contribName, setContribName] = useState('');
  const [contribRelation, setContribRelation] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const storiesById = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const bookId = book?.id;
  const userId = user?.uid;

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    const name = userDisplayName(user, profile);
    getOrCreateBook(user.uid, name)
      .then((b) => {
        setBook(b);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadError('Could not load book. / पुस्तक लोड नहीं हो सकी।');
        setLoading(false);
      });
  }, [user, profile]);

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
    if (!bookId) return;
    return subscribeToInvites(bookId, setInvites);
  }, [bookId]);

  const contributorStories = stories.filter(
    (s) => s.isContributorStory && !chapters.some((c) => c.storyOrder.includes(s.id)),
  );

  const handleAddChapter = async () => {
    if (!book || !user || !newChapterTitle.trim()) return;
    setAddingChapter(true);
    try {
      await createChapter(book.id, user.uid, newChapterTitle.trim());
      setNewChapterTitle('');
      setTab('toc');
    } finally {
      setAddingChapter(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!book || !user || !contribName.trim() || !contribRelation.trim()) return;
    setCreatingInvite(true);
    try {
      await createContributorInvite({
        bookId: book.id,
        ownerId: user.uid,
        ownerName: profile?.displayName ?? 'Author',
        bookTitle: book.title,
        contributorName: contribName.trim(),
        relationship: contribRelation.trim(),
      });
      setContribName('');
      setContribRelation('');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleAssignStory = async (storyId: string, toChapterId: string) => {
    const story = stories.find((s) => s.id === storyId);
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

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (loadError || !book) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-6 text-center">
        <p className="text-slate-700">{loadError || 'Book unavailable / पुस्तक उपलब्ध नहीं'}</p>
      </div>
    );
  }

  const publicUrl = bookPublicUrl(book.publicSlug);

  return (
    <div className="px-4 py-6">
      <PageHeading en="My Book" hi="मेरी पुस्तक" className="mb-4" />

      <div className="mb-6 flex gap-2">
        {([
          ['settings', 'Book Settings', 'पुस्तक सेटिंग्स'],
          ['toc', 'Table of Contents', 'विषय सूची'],
        ] as const).map(([id, en, hi]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              tab === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setTab(id)}
          >
            {en}
            <span className={`block text-xs font-normal ${tab === id ? 'text-brand-100' : 'font-hindi text-slate-500'}`}>
              {hi}
            </span>
          </button>
        ))}
      </div>

      <Link
        to="/book/album"
        className="card mb-6 flex items-center gap-4 py-4 transition active:scale-[0.99] hover:ring-2 hover:ring-brand-200"
      >
        <span className="text-3xl">📖</span>
        <div className="flex-1">
          <BilingualLine
            en="Browse your album"
            hi="अपनी एल्बम ब्राउज़ करें"
            enClass="font-semibold text-brand-700"
            hiClass="text-sm text-brand-600"
          />
          <BilingualLine
            en="Photo-album view with text, images & audio QR codes — anytime"
            hi="फोटो-एल्बम दृश्य — टेक्स्ट, फोटो और ऑडियो QR — कभी भी"
            enClass="text-sm text-slate-500"
            hiClass="text-xs text-slate-400"
          />
        </div>
        <span className="text-brand-400">→</span>
      </Link>

      {tab === 'settings' && (
        <>
          <BilingualLine
            en="Title, publishing, QR code, and contributor invites."
            hi="शीर्षक, प्रकाशन, QR कोड, और योगदानकर्ता आमंत्रण।"
            enClass="mb-4 text-sm text-slate-500"
            hiClass="mb-4 text-xs text-slate-400"
          />

          <div className="card mb-4">
            <input
              className="input-field mb-2 font-semibold"
              value={book.title}
              onChange={(e) => setBook({ ...book, title: e.target.value })}
              onBlur={() => updateBookTitle(book.id, book.title)}
            />
            <p className="text-sm text-slate-500">by {book.authorName} / द्वारा {book.authorName}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  book.isPublished ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
                onClick={() => publishBook(book.id, !book.isPublished)}
              >
                {book.isPublished ? (
                  <BilingualBtn en="Published ✓" hi="प्रकाशित ✓" />
                ) : (
                  <BilingualBtn en="Publish Book" hi="पुस्तक प्रकाशित करें" />
                )}
              </button>
              {book.isPublished && (
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 underline">
                  View live book / लाइव पुस्तक देखें
                </a>
              )}
            </div>
            <div className="mt-6 flex justify-center">
              <QrCodeDisplay url={publicUrl} label="Scan to read the full book / पूरी पुस्तक पढ़ने के लिए स्कैन करें" size={160} />
            </div>
          </div>

          <SectionHeading en="Invite Contributors" hi="योगदानकर्ताओं को आमंत्रित करें" />
          <div className="card mb-4 space-y-3">
            <BilingualLine
              en="Send a personal link so others can add stories."
              hi="दूसरों को कहानियाँ जोड़ने के लिए व्यक्तिगत लिंक भेजें।"
              enClass="text-sm text-slate-600"
              hiClass="text-sm text-slate-500"
            />
            <input
              className="input-field"
              placeholder="Their name (e.g. Priya) / उनका नाम"
              value={contribName}
              onChange={(e) => setContribName(e.target.value)}
            />
            <input
              className="input-field"
              placeholder="Relationship (e.g. Daughter) / संबंध"
              value={contribRelation}
              onChange={(e) => setContribRelation(e.target.value)}
              list="relationships"
            />
            <datalist id="relationships">
              {RELATIONSHIP_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={handleCreateInvite}
              disabled={creatingInvite || !contribName.trim() || !contribRelation.trim()}
            >
              {creatingInvite ? (
                <BilingualBtn en="Creating…" hi="बना रहे हैं…" />
              ) : (
                <BilingualBtn en="Create Invite Link" hi="आमंत्रण लिंक बनाएं" />
              )}
            </button>
          </div>

          {invites.filter((i) => i.isActive).map((inv) => (
            <div key={inv.id} className="card mb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-800">{inv.contributorName}</p>
                  <p className="text-sm text-brand-600">{inv.relationship}</p>
                </div>
                <button type="button" className="text-xs text-red-500" onClick={() => deactivateInvite(inv.id)}>
                  Revoke / रद्द
                </button>
              </div>
              <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                <QrCodeDisplay url={getInviteLink(inv)} label="Share this link / यह लिंक साझा करें" size={120} />
                <div className="min-w-0 flex-1">
                  <input className="input-field text-xs" readOnly value={getInviteLink(inv)} onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button type="button" className="btn-secondary mt-2 w-full text-sm" onClick={() => navigator.clipboard.writeText(getInviteLink(inv))}>
                    <BilingualBtn en="Copy Link" hi="लिंक कॉपी" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {contributorStories.length > 0 && (
            <>
              <SectionHeading en="Contributor Submissions (unassigned)" hi="योगदानकर्ता प्रस्तुतियाँ (असाइन नहीं)" />
              <p className="mb-2 text-xs text-slate-500">
                Assign these from the Table of Contents tab. / विषय सूची टैब से असाइन करें।
              </p>
              {contributorStories.map((story) => (
                <div key={story.id} className="card mb-2 py-3">
                  <p className="font-medium text-slate-800">{story.title}</p>
                  <p className="text-xs text-accent-700">{story.contributorName} · {story.contributorRelationship}</p>
                  <Link to={`/stories/${story.id}`} className="mt-2 inline-block text-sm text-brand-600">
                    Review / समीक्षा →
                  </Link>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'toc' && book && user && (
        <BookTocEditor
          book={book}
          chapters={chapters}
          stories={stories}
          userId={user.uid}
          newChapterTitle={newChapterTitle}
          onNewChapterTitleChange={setNewChapterTitle}
          onAddChapter={handleAddChapter}
          addingChapter={addingChapter}
          onMoveChapter={handleMoveChapter}
          onMoveStoryInChapter={handleMoveStoryInChapter}
          onAssignStory={handleAssignStory}
          onAutoSortChapter={(chapterId) => autoSortChapterStories(chapterId, storiesById)}
          onUpdateChapterTitle={updateChapterTitle}
        />
      )}
    </div>
  );
}
