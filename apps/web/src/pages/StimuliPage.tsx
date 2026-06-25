import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import {
  getNextPrompt,
  PROMPT_TEMPLATES,
  promptCategory,
  promptText,
  promptTitle,
} from '@/data/stimuli';
import { useBook } from '@/context/BookContext';
import { useBookPrompts } from '@/hooks/useBookPrompts';
import { createStoryInBook } from '@/services/bookStructure';
import { importPromptTemplate, deleteBookPrompt } from '@/services/bookPrompts';
import { userDisplayName } from '@/lib/userDisplayName';
import { AddBookPromptModal } from '@/components/AddBookPromptModal';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { T } from '@/components/BilingualText';
import type { BookPrompt } from '@/types';

export function StimuliPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const t = usePickText();
  const { locale } = useUiLocale();
  const { activeBook } = useBook();
  const { prompts, completedIds, loading, bookId, userId } = useBookPrompts();
  const [showAdd, setShowAdd] = useState(false);
  const [editPrompt, setEditPrompt] = useState<BookPrompt | null>(null);
  const [importing, setImporting] = useState(false);

  const next = getNextPrompt(prompts, completedIds);
  const isOwner = activeBook?.ownerId === user?.uid;
  const doneCount = completedIds.length;
  const total = prompts.length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const startPrompt = async (prompt: BookPrompt) => {
    if (!user || !activeBook) return;
    const sessionId = await createStoryInBook(
      {
        userId: user.uid,
        bookId: activeBook.id,
        title: promptTitle(prompt, locale),
        sourceType: 'stimulus',
        stimulusId: prompt.id,
        stimulusPrompt: promptText(prompt, locale),
        languageHint: profile?.preferences.defaultLanguage ?? 'mixed',
        hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
        perspective: profile?.preferences.storyPerspective ?? 'first',
      },
      activeBook,
      userDisplayName(user, profile),
    );
    navigate(`/story/${sessionId}`);
  };

  const handleImportAutobiography = async () => {
    if (!bookId || !userId) return;
    setImporting(true);
    try {
      await importPromptTemplate(bookId, userId, 'autobiography');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (prompt: BookPrompt) => {
    if (!bookId || prompt.source === 'system') return;
    if (!window.confirm(t({ en: 'Delete this prompt?', hi: 'यह प्रश्न हटाएं?' }))) return;
    await deleteBookPrompt(bookId, prompt.id);
  };

  if (loading) {
    return (
      <div className="heritage-page text-center text-heritage-muted">
        <T en="Loading prompts…" hi="प्रश्न लोड हो रहे…" />
      </div>
    );
  }

  return (
    <div className="heritage-page">
      <HeritagePageTitle
        en="Prompts"
        hi="प्रश्न"
        subtitle={{ en: 'Twelve questions', hi: 'बारह सवाल' }}
      />

      {total > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs font-medium text-heritage-muted">
            <span className={locale === 'hi' ? 'font-hindi' : ''}>
              {t({ en: `${doneCount} of ${total} complete`, hi: `${doneCount} / ${total} पूर्ण` })}
            </span>
            <span>
              {String(doneCount).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-heritage-line">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {prompts.length === 0 && (
        <div className="card mb-6 border-dashed text-center">
          <p className={`text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({
              en: PROMPT_TEMPLATES.autobiography.descriptionEn,
              hi: PROMPT_TEMPLATES.autobiography.descriptionHi,
            })}
          </p>
          {bookId && userId && (
            <button type="button" className="btn-primary mt-4" disabled={importing} onClick={handleImportAutobiography}>
              {importing ? t({ en: 'Adding…', hi: 'जोड़ रहे…' }) : t({ en: 'Add life story set', hi: 'जीवन कथा सेट जोड़ें' })}
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {prompts.map((s, index) => {
          const done = completedIds.includes(s.id);
          const isNext = next?.id === s.id;
          const num = String(index + 1).padStart(2, '0');

          if (done) {
            return (
              <div key={s.id} className="flex gap-4 opacity-50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-heritage-ink text-sm text-white">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-serif text-base line-through text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
                    {promptText(s, locale)}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              className={`flex w-full cursor-pointer gap-4 rounded-xl text-left transition hover:bg-heritage-cream/60 ${
                isNext ? '' : 'opacity-90'
              }`}
              onClick={() => void startPrompt(s)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void startPrompt(s);
                }
              }}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  isNext ? 'bg-brand-600 text-white' : 'border border-heritage-line text-heritage-muted'
                }`}
              >
                {num}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-serif text-base leading-snug text-heritage-ink ${locale === 'hi' ? 'font-hindi' : ''}`}>
                  {promptText(s, locale)}
                </p>
                {s.category && (
                  <p className="mt-1 text-xs text-heritage-muted">{promptCategory(s, locale)}</p>
                )}
              </div>
              {isOwner && s.source === 'user' && (
                <div className="flex shrink-0 items-start gap-1 pt-0.5">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-base text-slate-500 hover:bg-slate-100"
                    aria-label={t({ en: 'Edit prompt', hi: 'प्रश्न संपादित करें' })}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditPrompt(s);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-base text-red-500 hover:bg-red-50"
                    aria-label={t({ en: 'Delete prompt', hi: 'प्रश्न हटाएं' })}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(s);
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {bookId && userId && (
        <button
          type="button"
          className="btn-secondary mt-8 w-full border-dashed"
          onClick={() => setShowAdd(true)}
        >
          {t({ en: '+ Add custom prompt', hi: '+ अपना प्रश्न जोड़ें' })}
        </button>
      )}

      {bookId && userId && (
        <AddBookPromptModal
          open={showAdd || editPrompt !== null}
          onClose={() => {
            setShowAdd(false);
            setEditPrompt(null);
          }}
          bookId={bookId}
          userId={userId}
          prompt={editPrompt}
        />
      )}
    </div>
  );
}
