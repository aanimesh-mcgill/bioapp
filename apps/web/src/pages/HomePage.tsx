import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function HomePage() {
  const { profile } = useAuth();
  const name = profile?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="px-4 py-6">
      <header className="mb-8">
        <p className="text-sm text-slate-500">Welcome back</p>
        <h1 className="text-2xl font-bold text-brand-600">Hi, {name}</h1>
      </header>

      <Link
        to="/record"
        className="card mb-6 flex items-center gap-4 bg-brand-600 text-white active:scale-[0.98] transition"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
          🎙️
        </span>
        <div>
          <p className="text-lg font-semibold">Record a Story</p>
          <p className="text-sm text-brand-100">Tap to start speaking your memories</p>
        </div>
      </Link>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          How it works
        </h2>
        {[
          { step: '1', text: 'Record your story in English or Hindi' },
          { step: '2', text: 'Whisper transcribes your audio automatically' },
          { step: '3', text: 'AI turns it into a polished narrative draft' },
          { step: '4', text: 'Edit and approve before publishing' },
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
