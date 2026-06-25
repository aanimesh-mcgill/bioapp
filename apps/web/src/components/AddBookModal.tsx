import { useState } from 'react';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';

interface AddBookModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string) => Promise<void>;
}

export function AddBookModal({ open, onClose, onCreate }: AddBookModalProps) {
  const t = usePickText();
  const { locale } = useUiLocale();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setError('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t({ en: 'Book title is required.', hi: 'पुस्तक का शीर्षक आवश्यक है।' }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreate(title.trim(), description.trim());
      handleClose();
    } catch {
      setError(t({ en: 'Could not create book.', hi: 'पुस्तक नहीं बना सके।' }));
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
          en="New book"
          hi="नई पुस्तक"
          enClass="text-lg font-semibold text-brand-800"
          hiClass="text-sm text-brand-600"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className={`text-sm text-slate-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({
            en: 'Each book has its own prompts, stories, and chapters.',
            hi: 'प्रत्येक पुस्तक के अपने प्रश्न, कहानियाँ और अध्याय होते हैं।',
          })}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            {t({ en: 'Title', hi: 'शीर्षक' })}
          </span>
          <input
            className="input-field w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t({ en: 'Book title', hi: 'पुस्तक का शीर्षक' })}
            maxLength={120}
            disabled={submitting}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            {t({ en: 'Description (optional)', hi: 'विवरण (वैकल्पिक)' })}
          </span>
          <textarea
            className="input-field min-h-[80px] w-full resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t({ en: 'What is this book about?', hi: 'यह पुस्तक किस बारे में है?' })}
            maxLength={300}
            disabled={submitting}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting || !title.trim()}>
          <BilingualBtn en={submitting ? 'Creating…' : 'Create book'} hi={submitting ? 'बना रहे…' : 'पुस्तक बनाएं'} />
        </button>
      </form>
    </Modal>
  );
}
