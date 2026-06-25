import { useEffect, useState } from 'react';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { T } from '@/components/BilingualText';
import { createChapterForCollabBook } from '@/services/bookStructure';
import type { Chapter } from '@/types';
import type { AuthorBook } from '@/types';

type ChapterAssignSheetProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (chapterId: string) => void | Promise<void>;
  activeBook: AuthorBook;
  chapters: Chapter[];
  suggestedChapterId?: string | null;
  storyTitle?: string;
  busy?: boolean;
  userId: string;
  authorName: string;
};

const chapterOptionClass = (selected: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
    selected
      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600'
      : 'border-heritage-line bg-white hover:border-brand-300'
  }`;

export function ChapterAssignSheet({
  open,
  onClose,
  onConfirm,
  activeBook,
  chapters,
  suggestedChapterId,
  storyTitle,
  busy,
  userId,
  authorName,
}: ChapterAssignSheetProps) {
  const t = usePickText();
  const { locale } = useUiLocale();
  const [selectedId, setSelectedId] = useState<string>(
    suggestedChapterId ?? chapters[0]?.id ?? 'unassigned',
  );
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(suggestedChapterId ?? chapters[0]?.id ?? 'unassigned');
    }
  }, [open, suggestedChapterId, chapters]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handleCreateChapter = async () => {
    const title = newChapterTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const id = await createChapterForCollabBook(userId, activeBook, authorName, title);
      setSelectedId(id);
      setNewChapterTitle('');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = () => {
    if (selectedId === 'unassigned') {
      onClose();
      return;
    }
    void onConfirm(selectedId);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="relative z-10 flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-heritage-line bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-heritage-line" />
          <h2 className={`font-serif text-2xl text-heritage-ink ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({ en: 'Where should this story live?', hi: 'यह कहानी किस अध्याय में रखें?' })}
          </h2>
          {storyTitle && (
            <p className="mt-1 font-serif text-sm italic text-heritage-muted">{storyTitle}</p>
          )}

          <div className="mt-5">
            <p className="heritage-label mb-2">{t({ en: 'Book', hi: 'पुस्तक' })}</p>
            <div className="flex items-center gap-3 rounded-xl border border-heritage-line bg-white p-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-heritage-ink text-xs font-bold text-white">
                BK
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-heritage-ink">{activeBook.title}</p>
                <p className="text-xs text-heritage-muted">
                  {t({ en: 'Active book', hi: 'सक्रिय पुस्तक' })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="heritage-label mb-2">{t({ en: 'Chapter', hi: 'अध्याय' })}</p>
            <div className="space-y-2">
              {chapters.map((ch) => (
                <label key={ch.id} className={chapterOptionClass(selectedId === ch.id)}>
                  <input
                    type="radio"
                    name="chapter"
                    className="mt-1"
                    checked={selectedId === ch.id}
                    onChange={() => setSelectedId(ch.id)}
                  />
                  <div>
                    <p className="font-medium text-heritage-ink">{ch.title}</p>
                    <p className="text-xs text-heritage-muted">
                      {ch.storyOrder.length}{' '}
                      {t({ en: ch.storyOrder.length === 1 ? 'story' : 'stories', hi: 'कहानियाँ' })}
                      {suggestedChapterId === ch.id &&
                        ` · ${t({ en: 'Suggested', hi: 'सुझाया गया' })}`}
                    </p>
                  </div>
                </label>
              ))}
              <label className={chapterOptionClass(selectedId === 'unassigned')}>
                <input
                  type="radio"
                  name="chapter"
                  className="mt-1"
                  checked={selectedId === 'unassigned'}
                  onChange={() => setSelectedId('unassigned')}
                />
                <div>
                  <p className="font-medium text-heritage-ink">
                    {t({ en: 'Unassigned', hi: 'अनियत' })}
                  </p>
                  <p className="text-xs text-heritage-muted">
                    {t({ en: 'Add to a chapter later', hi: 'बाद में अध्याय में जोड़ें' })}
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="input-field flex-1 bg-white text-sm"
                placeholder={t({ en: 'New chapter title', hi: 'नया अध्याय शीर्षक' })}
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost shrink-0"
                disabled={creating || !newChapterTitle.trim()}
                onClick={handleCreateChapter}
              >
                {t({ en: '+ New', hi: '+ नया' })}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary mt-6 w-full"
            disabled={busy || selectedId === 'unassigned'}
            onClick={handleConfirm}
          >
            {busy ? (
              <T en="Saving…" hi="सहेज रहे…" />
            ) : (
              <T en="Add to chapter" hi="अध्याय में जोड़ें" />
            )}
          </button>
          {selectedId === 'unassigned' && (
            <button type="button" className="btn-secondary mt-2 w-full" onClick={onClose}>
              <T en="Skip for now" hi="अभी छोड़ें" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
