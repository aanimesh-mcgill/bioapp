import { useEffect, useState } from 'react';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { createBookPrompt, updateBookPrompt } from '@/services/bookPrompts';
import type { BookPrompt } from '@/types';

interface AddBookPromptModalProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  userId: string;
  /** When set, modal edits an existing prompt instead of creating one. */
  prompt?: BookPrompt | null;
}

export function AddBookPromptModal({ open, onClose, bookId, userId, prompt }: AddBookPromptModalProps) {
  const t = usePickText();
  const { locale } = useUiLocale();
  const isEdit = Boolean(prompt);
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (prompt) {
      setTitle(prompt.titleEn);
      setPromptText(prompt.promptEn);
      setCategory(prompt.category ?? '');
    } else {
      setTitle('');
      setPromptText('');
      setCategory('');
    }
    setError('');
    setSubmitting(false);
  }, [open, prompt]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !promptText.trim()) {
      setError(t({ en: 'Title and prompt are required.', hi: 'शीर्षक और प्रश्न आवश्यक हैं।' }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        titleEn: title.trim(),
        promptEn: promptText.trim(),
        category: category.trim() || undefined,
      };
      if (prompt) {
        await updateBookPrompt(bookId, prompt.id, payload);
      } else {
        await createBookPrompt(bookId, userId, payload);
      }
      handleClose();
    } catch (err) {
      console.error(err);
      setError(t({ en: 'Could not save prompt.', hi: 'प्रश्न सहेज नहीं सके।' }));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      busy={submitting}
      title={
        <BilingualLine
          en={isEdit ? 'Edit prompt' : 'New prompt'}
          hi={isEdit ? 'प्रश्न संपादित करें' : 'नया प्रश्न'}
          enClass="text-lg font-semibold text-brand-800"
          hiClass="text-sm text-brand-600"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className={`text-sm text-slate-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({
            en: isEdit
              ? 'Update this prompt for your book.'
              : 'Create a custom prompt for this book. You can record a story from it on the next screen.',
            hi: isEdit
              ? 'अपनी पुस्तक के लिए यह प्रश्न अपडेट करें।'
              : 'इस पुस्तक के लिए अपना प्रश्न बनाएं। अगली स्क्रीन से आप इस पर कहानी रिकॉर्ड कर सकते हैं।',
          })}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            {t({ en: 'Title', hi: 'शीर्षक' })}
          </span>
          <input
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t({ en: 'e.g. Favorite birthday memory', hi: 'जैसे — पसंदीदा जन्मदिन की याद' })}
            disabled={submitting}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            {t({ en: 'Prompt', hi: 'प्रश्न' })}
          </span>
          <textarea
            className="input min-h-[100px] w-full resize-y"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder={t({
              en: 'What should the storyteller talk about?',
              hi: 'कथाकार को किस बारे में बोलना चाहिए?',
            })}
            disabled={submitting}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            {t({ en: 'Category (optional)', hi: 'श्रेणी (वैकल्पिक)' })}
          </span>
          <input
            className="input w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t({ en: 'e.g. Celebrations', hi: 'जैसे — उत्सव' })}
            disabled={submitting}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          <BilingualBtn
            en={submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save Prompt'}
            hi={submitting ? 'सहेज रहे…' : isEdit ? 'बदलाव सहेजें' : 'प्रश्न सहेजें'}
          />
        </button>
      </form>
    </Modal>
  );
}
