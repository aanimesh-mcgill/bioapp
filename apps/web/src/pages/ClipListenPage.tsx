import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ClipPlayButton } from '@/components/ClipPlayButton';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { getClipForListen } from '@/services/books';
import type { AudioClip, Book } from '@/types';

export function ClipListenPage() {
  const t = usePickText();
  const { bookSlug, clipId } = useParams<{ bookSlug: string; clipId: string }>();
  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookSlug || !clipId) return;
    getClipForListen(bookSlug, clipId)
      .then((data) => {
        if (!data) {
          setError(t({ en: 'Audio not found.', hi: 'ऑडियो नहीं मिला।' }));
          return;
        }
        if (!data.book.isPublished && user?.uid !== data.book.userId) {
          setError(t({ en: 'This book is not published yet.', hi: 'यह पुस्तक अभी प्रकाशित नहीं है।' }));
          return;
        }
        setBook(data.book);
        setClip(data.clip);
        setStoryTitle(data.storyTitle);
      })
      .catch(() => setError(t({ en: 'Failed to load audio.', hi: 'ऑडियो लोड करने में विफल।' })))
      .finally(() => setLoading(false));
  }, [bookSlug, clipId, user?.uid, t]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4ebe0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !book || !clip) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4ebe0] px-6 text-center">
        <p className="text-slate-700">{error || 'Unavailable'}</p>
        {bookSlug && (
          <Link to={`/read/${bookSlug}`} className="btn-primary mt-6">
            <BilingualBtn en="Open book" hi="पुस्तक खोलें" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4ebe0] px-6">
      <div className="w-full max-w-sm rounded-sm bg-[#fffef9] p-8 text-center shadow-lg ring-1 ring-amber-200/50">
        <p className="text-[10px] uppercase tracking-widest text-amber-800/60">AATMA KATHA</p>
        <h1 className="mt-2 font-serif text-xl font-bold text-amber-950">{book.title}</h1>
        <p className="mt-1 text-sm text-amber-900/70">{storyTitle}</p>
        <div className="my-8 flex justify-center">
          <ClipPlayButton audioUrl={clip.audioUrl} size="lg" />
        </div>
        <BilingualLine
          en="Tap play to hear this memory"
          hi="यह याद सुनने के लिए Play दबाएं"
          enClass="text-sm text-amber-800/70"
          hiClass="text-xs text-amber-700/60"
        />
        {clip.transcript?.text && (
          <p className="mt-6 text-left font-serif text-sm leading-relaxed text-amber-950/80">{clip.transcript.text}</p>
        )}
        <Link to={`/read/${bookSlug}`} className="mt-8 inline-block text-sm font-semibold text-brand-600">
          ← {t({ en: 'Full album', hi: 'पूरी एल्बम' })}
        </Link>
      </div>
    </div>
  );
}
