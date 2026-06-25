import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import {
  BilingualBtn,
  PageHeading,
  SectionHeading,
  T,
} from '@/components/BilingualText';
import { ContributedStoriesSection } from '@/components/contributor/ContributedStoriesSection';
import { updateBookMetadata } from '@/services/booksCollaboration';
import { AddBookModal } from '@/components/AddBookModal';
import { BookSharingSections } from '@/components/book-sharing/BookSharingSections';
import { useContributedStories } from '@/hooks/useContributedStories';
import type { AuthorBook } from '@/types';

type BooksTab = 'manage' | 'sharing' | 'contributions';

function ChangeActiveBookModal({
  open,
  books,
  activeBookId,
  onClose,
  onSelect,
}: {
  open: boolean;
  books: AuthorBook[];
  activeBookId: string | null;
  onClose: () => void;
  onSelect: (bookId: string) => void;
}) {
  const t = usePickText();
  const { locale } = useUiLocale();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-active-book-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2
            id="change-active-book-title"
            className={`text-lg font-semibold text-slate-900 ${locale === 'hi' ? 'font-hindi' : ''}`}
          >
            {t({ en: 'Choose active book', hi: 'सक्रिय पुस्तक चुनें' })}
          </h2>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {books.length === 0 ? (
            <li className={`px-3 py-4 text-sm text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
              {t({
                en: 'No books yet. Create one in My Books.',
                hi: 'अभी कोई पुस्तक नहीं। मेरी पुस्तकें में एक बनाएं।',
              })}
            </li>
          ) : (
            books.map((book) => {
              const isActive = book.id === activeBookId;
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${
                      isActive ? 'bg-brand-50 ring-2 ring-brand-400' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => onSelect(book.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{book.title}</p>
                        {book.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{book.description}</p>
                        )}
                      </div>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                          <T en="Active" hi="सक्रिय" />
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-slate-200 p-3">
          <button type="button" className="btn-secondary w-full" onClick={onClose}>
            <BilingualBtn en="Cancel" hi="रद्द" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function BooksPage() {
  const { user, profile } = useAuth();
  const { books, activeBook, loading, selectBook, createAndSelectBook, deleteOwnedBook } = useBook();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<BooksTab>('manage');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [changeActiveOpen, setChangeActiveOpen] = useState(false);
  const [addBookOpen, setAddBookOpen] = useState(false);

  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  const isManageOwner = !!user && !!selectedBook && selectedBook.ownerId === user.uid;
  const isActiveOwner = !!user && !!activeBook && activeBook.ownerId === user.uid;

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'active' || tabParam === 'sharing') {
      setTab('sharing');
    } else if (tabParam === 'contributions') {
      setTab('contributions');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedBookId && activeBook?.id) {
      setSelectedBookId(activeBook.id);
    }
  }, [activeBook?.id, selectedBookId]);

  useEffect(() => {
    if (selectedBook) {
      setEditTitle(selectedBook.title);
      setEditDescription(selectedBook.description ?? '');
    }
  }, [selectedBook]);

  useEffect(() => {
    if (selectedBookId && !books.some((b) => b.id === selectedBookId)) {
      setSelectedBookId(activeBook?.id ?? books[0]?.id ?? '');
    }
  }, [books, selectedBookId, activeBook?.id]);

  const handleCreateBook = async (title: string, description: string) => {
    setBusy(true);
    setError('');
    try {
      const newId = await createAndSelectBook(title, description);
      if (newId) setSelectedBookId(newId);
    } catch {
      setError(t({ en: 'Could not create a new book.', hi: 'नई पुस्तक नहीं बना सके।' }));
      throw new Error('create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook || !user || !isManageOwner) return;
    const confirmed = window.confirm(
      t({
        en: `Delete "${selectedBook.title}"? This cannot be undone.`,
        hi: `"${selectedBook.title}" हटाएं? यह वापस नहीं हो सकता।`,
      }),
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await deleteOwnedBook(selectedBook.id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t({ en: 'Could not delete book.', hi: 'पुस्तक नहीं हटा सके।' }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedBook || !user || !editTitle.trim()) return;
    setBusy(true);
    setError('');
    try {
      await updateBookMetadata(selectedBook.id, user.uid, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t({ en: 'Could not save book details.', hi: 'पुस्तक विवरण सहेज नहीं सके।' }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleChangeActive = (bookId: string) => {
    selectBook(bookId);
    setSelectedBookId(bookId);
    setChangeActiveOpen(false);
  };

  const activeSuffix = t({ en: ' (active)', hi: ' (सक्रिय)' });
  const { loading: contributionsLoading, activeInvites, groups: contributedGroups } =
    useContributedStories();

  return (
    <div className="heritage-page px-4 py-6">
      <PageHeading en="Library" hi="पुस्तकालय" />

      <div className="mb-6 mt-4 flex gap-2">
        {(
          [
            ['manage', { en: 'My Books', hi: 'मेरी पुस्तकें' }],
            ['sharing', { en: 'Active', hi: 'सक्रिय' }],
            ['contributions', { en: 'Contributions', hi: 'योगदान' }],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold sm:text-sm ${
              tab === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            } ${locale === 'hi' && tab === id ? 'font-hindi' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {error && (
        <p className={`mb-3 text-sm text-red-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>{error}</p>
      )}
      {saved && (
        <p className={`mb-3 text-sm text-green-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({ en: 'Saved.', hi: 'सहेजा गया।' })}
        </p>
      )}

      {tab === 'manage' && (
        <div className="space-y-4">
          <section className="card space-y-3">
            <SectionHeading en="Select a book" hi="पुस्तक चुनें" />
            <select
              className="input-field"
              value={selectedBookId}
              disabled={loading || sortedBooks.length === 0}
              onChange={(event) => setSelectedBookId(event.target.value)}
            >
              {sortedBooks.length === 0 ? (
                <option value="">{t({ en: 'No books yet', hi: 'अभी कोई पुस्तक नहीं' })}</option>
              ) : (
                sortedBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                    {book.id === activeBook?.id ? activeSuffix : ''}
                  </option>
                ))
              )}
            </select>
            {selectedBook && (
              <p className={`text-xs text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                {isManageOwner
                  ? t({ en: 'You own this book.', hi: 'यह आपकी पुस्तक है।' })
                  : t({ en: 'You are a collaborator.', hi: 'आप सहयोगी हैं।' })}
                {selectedBook.collaborators.length > 0 &&
                  ` · ${selectedBook.collaborators.length} ${t({ en: 'collaborator(s)', hi: 'सहयोगी' })}`}
              </p>
            )}
          </section>

          {selectedBook && isManageOwner && (
            <section className="card space-y-3">
              <SectionHeading en="Edit book details" hi="पुस्तक विवरण संपादित करें" />
              <input
                className="input-field"
                placeholder={t({ en: 'Book title', hi: 'पुस्तक का शीर्षक' })}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                maxLength={120}
              />
              <textarea
                className="input-field min-h-[90px] resize-y"
                placeholder={t({ en: 'Description', hi: 'विवरण' })}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                maxLength={300}
              />
              <button
                className="btn-primary w-full"
                disabled={busy || !editTitle.trim()}
                onClick={handleSaveMetadata}
              >
                <BilingualBtn
                  en={busy ? 'Saving…' : 'Save details'}
                  hi={busy ? 'सहेज रहे…' : 'विवरण सहेजें'}
                />
              </button>
              <button
                type="button"
                className="btn-secondary w-full text-red-600 hover:bg-red-50"
                disabled={busy}
                onClick={handleDeleteBook}
              >
                <BilingualBtn en="Delete book" hi="पुस्तक हटाएं" />
              </button>
            </section>
          )}

          <section className="card">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setAddBookOpen(true)}
            >
              <BilingualBtn en="+ Add a new book" hi="+ नई पुस्तक जोड़ें" />
            </button>
          </section>
        </div>
      )}

      {tab === 'sharing' && (
        <div className="space-y-4">
          <section className="card space-y-3">
            <SectionHeading en="Active book" hi="सक्रिय पुस्तक" />

            {loading ? (
              <p className={`text-sm text-slate-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                {t({ en: 'Loading…', hi: 'लोड हो रहा…' })}
              </p>
            ) : activeBook ? (
              <>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeBook.title}</h2>
                  {activeBook.description ? (
                    <p className="mt-1 text-sm text-slate-600">{activeBook.description}</p>
                  ) : (
                    <p className={`mt-1 text-sm italic text-slate-400 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                      {t({ en: 'No description', hi: 'कोई विवरण नहीं' })}
                    </p>
                  )}
                </div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                    <dt className={`text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                      {t({ en: 'Your role', hi: 'आपकी भूमिका' })}
                    </dt>
                    <dd className={`font-medium text-slate-800 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                      {isActiveOwner
                        ? t({ en: 'Owner', hi: 'स्वामी' })
                        : t({ en: 'Collaborator', hi: 'सहयोगी' })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                    <dt className={`text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                      {t({ en: 'Collaborators', hi: 'सहयोगी' })}
                    </dt>
                    <dd className="font-medium text-slate-800">{activeBook.collaborators.length}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                    <dt className={`text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                      {t({ en: 'Last updated', hi: 'अंतिम अपडेट' })}
                    </dt>
                    <dd className="font-medium text-slate-800">
                      {activeBook.updatedAt.toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className={`text-sm text-slate-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                {t({ en: 'No active book selected yet.', hi: 'अभी कोई सक्रिय पुस्तक नहीं चुनी।' })}
              </p>
            )}

            <button
              type="button"
              className="btn-secondary w-full"
              disabled={loading || sortedBooks.length === 0}
              onClick={() => setChangeActiveOpen(true)}
            >
              <BilingualBtn en="Change active book" hi="सक्रिय पुस्तक बदलें" />
            </button>
          </section>

          {activeBook && <BookSharingSections collabBook={activeBook} />}
        </div>
      )}

      {tab === 'contributions' && (
        <div className="space-y-6">
          {contributionsLoading ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            </div>
          ) : (
            <>
              {activeInvites.length > 0 && (
                <section className="space-y-3">
                  <SectionHeading en="Open invitations" hi="खुले आमंत्रण" />
                  {activeInvites.map((invite) => (
                    <Link
                      key={invite.id}
                      to={`/contribute/${invite.inviteSlug}/hub`}
                      className="card flex items-center gap-3 py-4 transition active:scale-[0.99]"
                    >
                      <span className="text-2xl">📖</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-lg text-heritage-ink">{invite.bookTitle}</p>
                        <p className="text-xs text-heritage-muted">
                          {t({ en: 'Invited by', hi: 'आमंत्रण' })} {invite.ownerName}
                        </p>
                      </div>
                      <span className="text-brand-600">→</span>
                    </Link>
                  ))}
                </section>
              )}

              <ContributedStoriesSection
                groups={contributedGroups}
                showContributeLink={false}
                showEmpty={activeInvites.length === 0}
              />
            </>
          )}
        </div>
      )}

      <ChangeActiveBookModal
        open={changeActiveOpen}
        books={sortedBooks}
        activeBookId={activeBook?.id ?? null}
        onClose={() => setChangeActiveOpen(false)}
        onSelect={handleChangeActive}
      />

      <AddBookModal
        open={addBookOpen}
        onClose={() => setAddBookOpen(false)}
        onCreate={handleCreateBook}
      />
    </div>
  );
}
