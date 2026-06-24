import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  createBook,
  ensureUserHasBook,
  subscribeToBooks,
} from '@/services/booksCollaboration';
import type { CollabBook } from '@/types';

interface BookContextValue {
  books: CollabBook[];
  activeBook: CollabBook | null;
  loading: boolean;
  selectBook: (bookId: string) => void;
  createAndSelectBook: (title: string, description?: string) => Promise<void>;
}

const BookContext = createContext<BookContextValue | null>(null);

export function BookProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [books, setBooks] = useState<CollabBook[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBooks([]);
      setActiveBookId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const storageKey = `autobio.activeBook.${user.uid}`;

    const initialize = async () => {
      try {
        await ensureUserHasBook(user.uid);
      } catch {
        // Firestore permission/network issues are surfaced in consuming views.
      }

      if (cancelled) return () => undefined;
      return subscribeToBooks(user.uid, (nextBooks) => {
        if (cancelled) return;
        setBooks(nextBooks);

        const persisted = localStorage.getItem(storageKey);
        setActiveBookId((prev) => {
          const candidate = [prev, persisted].find(
            (id) => !!id && nextBooks.some((book) => book.id === id),
          );
          const fallback = nextBooks[0]?.id ?? null;
          const resolved = candidate ?? fallback;
          if (resolved) localStorage.setItem(storageKey, resolved);
          return resolved;
        });
        setLoading(false);
      });
    };

    let unsubscribe = () => undefined;
    void initialize().then((unsub) => {
      unsubscribe = unsub ?? (() => undefined);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  const selectBook = (bookId: string) => {
    if (!user) return;
    setActiveBookId(bookId);
    localStorage.setItem(`autobio.activeBook.${user.uid}`, bookId);
  };

  const createAndSelectBook = async (title: string, description?: string) => {
    if (!user) return;
    const newBookId = await createBook(user.uid, title, description);
    selectBook(newBookId);
  };

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId) ?? null,
    [books, activeBookId],
  );

  return (
    <BookContext.Provider
      value={{
        books,
        activeBook,
        loading,
        selectBook,
        createAndSelectBook,
      }}
    >
      {children}
    </BookContext.Provider>
  );
}

export function useBook() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error('useBook must be used within BookProvider');
  return ctx;
}
