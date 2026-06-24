import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { BookSwitcher } from '@/components/BookSwitcher';

export function HomePage() {
  const { profile } = useAuth();
  const { activeBook } = useBook();
  const name = profile?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="px-4 py-6">
      <header className="mb-8">
        <p className="text-sm text-slate-500">Welcome back</p>
        <h1 className="text-2xl font-bold text-brand-600">Hi, {name}</h1>
      </header>

      <BookSwitcher />

      <Link
        to="/contribute"
        className="card mb-6 flex items-center gap-4 bg-brand-600 text-white active:scale-[0.98] transition"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
          📘
        </span>
        <div>
          <p className="text-lg font-semibold">Open Active Book</p>
          <p className="text-sm text-brand-100">
            {activeBook ? `Continue contributing to "${activeBook.title}"` : 'Start with a new book'}
          </p>
        </div>
      </Link>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          How it works
        </h2>
        {[
          { step: '1', text: 'Create and select a book from the book switcher' },
          { step: '2', text: 'Add/edit stories and share invite links with collaborators' },
          { step: '3', text: 'Upload multiple prompt-based audio clips in the carousel' },
          { step: '4', text: 'Preview and export a polished photobook PDF' },
        ].map(({ step, text }) => (
          <div key={step} className="card flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
              {step}
            </span>
            <p className="pt-1 text-sm text-slate-700">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
