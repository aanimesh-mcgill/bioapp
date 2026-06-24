import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicBookByToken } from '@/services/books';
import type { PublicBookSnapshot } from '@/types';

export function PublicBookPage() {
  const { token } = useParams<{ token: string }>();
  const [book, setBook] = useState<PublicBookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void getPublicBookByToken(token)
      .then(setBook)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-brand-600">Book not available</h1>
        <p className="mt-2 text-slate-600">
          This public link has expired or has not been generated yet.
        </p>
        <Link to="/login" className="btn-primary mt-6 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wide text-slate-500">Public photobook</p>
        <h1 className="text-3xl font-bold text-brand-600">{book.bookTitle}</h1>
        {book.description && <p className="mt-2 text-slate-600">{book.description}</p>}
      </header>

      <div className="space-y-4">
        {book.stories.map((story) => (
          <article key={story.id} className="card">
            <h2 className="text-lg font-semibold text-slate-900">{story.title}</h2>
            <p className="mt-1 text-xs text-slate-500">By {story.authorName}</p>
            {story.imageUrl && (
              <img
                src={story.imageUrl}
                alt={story.title}
                className="mt-3 h-52 w-full rounded-xl object-cover"
              />
            )}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {story.content}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
