import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { PageHeading, PageSubheading, BilingualBtn, T } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { createStoryInBook } from '@/services/bookStructure';
import { userDisplayName } from '@/lib/userDisplayName';

export function RecordPage() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const navigate = useNavigate();
  const t = usePickText();
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async () => {
    if (!user || !title.trim()) return;
    setSubmitting(true);
    try {
      const sessionId = await createStoryInBook(
        {
          userId: user.uid,
          bookId: activeBook.id,
          title: title.trim(),
          sourceType: 'freeform',
          languageHint: profile?.preferences.defaultLanguage ?? 'mixed',
          hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
          perspective: profile?.preferences.storyPerspective ?? 'first',
        },
        activeBook,
        userDisplayName(user, profile),
      );
      navigate(`/story/${sessionId}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeBook) {
    return (
      <div className="px-4 py-6">
        <PageHeading en="Record Story" hi="कहानी रिकॉर्ड करें" className="mb-4" />
        <div className="card text-sm text-slate-600">
          <T
            en="Select or create a book first from the Books page before recording."
            hi="रिकॉर्ड करने से पहले पुस्तकें पृष्ठ से पुस्तक चुनें या बनाएं।"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col px-4 py-6">
      <PageHeading en="New Story" hi="नई कहानी" />
      <PageSubheading
        en="Give your story a title, then record multiple short clips. Transcription runs in the background while you keep recording."
        hi="कहानी का शीर्षक दें, फिर कई छोटे क्लिप रिकॉर्ड करें। प्रतिलेखन पृष्ठभूमि में चलता रहेगा।"
      />

      <input
        className="input-field mb-6"
        placeholder={t({
          en: 'Story title (e.g. My childhood in Delhi)',
          hi: 'शीर्षक (जैसे दिल्ली में बचपन)',
        })}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={submitting}
      />

      <button
        type="button"
        className="btn-primary w-full"
        onClick={handleStart}
        disabled={submitting || !title.trim()}
      >
        {submitting ? (
          <BilingualBtn en="Starting…" hi="शुरू हो रहा…" />
        ) : (
          <BilingualBtn en="Start Recording Clips" hi="क्लिप रिकॉर्ड शुरू करें" />
        )}
      </button>
    </div>
  );
}
