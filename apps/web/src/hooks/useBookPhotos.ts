import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { subscribeToBookPhotos } from '@/services/bookPhotos';
import type { BookPhoto } from '@/types';

export function useBookPhotos() {
  const { user } = useAuth();
  const { activeBook, loading: bookLoading } = useBook();
  const [photos, setPhotos] = useState<BookPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const bookId = activeBook?.id;

  useEffect(() => {
    if (!bookId || bookLoading) {
      setPhotos([]);
      setLoading(!bookLoading);
      return;
    }

    setLoading(true);
    return subscribeToBookPhotos(bookId, (next) => {
      setPhotos(next);
      setLoading(false);
    });
  }, [bookId, bookLoading]);

  return {
    photos,
    loading: loading || bookLoading,
    activeBook,
    bookId,
    userId: user?.uid,
  };
}
