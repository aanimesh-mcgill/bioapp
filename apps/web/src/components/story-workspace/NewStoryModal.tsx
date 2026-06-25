import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { BilingualBtn, BilingualLine, SectionHeading } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';
import { PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';
import { createStoryInBook } from '@/services/bookStructure';
import { addImageBlock, addTextBlock } from '@/services/storyBlocks';
import { userDisplayName } from '@/lib/userDisplayName';

interface NewStoryModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'pick' | 'text' | 'photo';

export function NewStoryModal({ open, onClose }: NewStoryModalProps) {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const navigate = useNavigate();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [step, setStep] = useState<Step>('pick');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const prefs = profile?.preferences;
  const authorName = user ? userDisplayName(user, profile) : '';

  const reset = () => {
    setStep('pick');
    setError('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleTextSubmit = async (data: { content: string; date?: string; year?: number }) => {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const id = await createStoryInBook(
        {
          userId: user.uid,
          bookId: activeBook?.id,
          title: data.content.slice(0, 50) + (data.content.length > 50 ? '…' : ''),
          sourceType: 'text_stimulus',
          languageHint: prefs?.defaultLanguage ?? 'mixed',
          hindiOutputMode: prefs?.hindiOutputMode ?? 'hindi_script',
          perspective: prefs?.storyPerspective ?? 'first',
        },
        activeBook,
        authorName,
      );
      await addTextBlock(id, data);
      handleClose();
      navigate(`/story/${id}`);
    } catch {
      setError(t({ en: 'Could not create story.', hi: 'कहानी नहीं बन सकी।' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoSubmit = async (data: { file: File; date?: string; year?: number }) => {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const id = await createStoryInBook(
        {
          userId: user.uid,
          bookId: activeBook?.id,
          title: PHOTO_STORY_PLACEHOLDER,
          sourceType: 'image_stimulus',
          languageHint: prefs?.defaultLanguage ?? 'mixed',
          hindiOutputMode: prefs?.hindiOutputMode ?? 'hindi_script',
          perspective: prefs?.storyPerspective ?? 'first',
        },
        activeBook,
        authorName,
      );
      await addImageBlock(user.uid, id, { ...data, title: '' });
      handleClose();
      navigate(`/story/${id}`);
    } catch (err) {
      console.error('Photo story create failed:', err);
      setError(t({ en: 'Could not save photo.', hi: 'फोटो सहेज नहीं सके।' }));
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === 'pick' ? (
      <SectionHeading en="New story" hi="नई कहानी" />
    ) : step === 'text' ? (
      <SectionHeading en="Text note" hi="टेक्स्ट नोट" />
    ) : (
      <SectionHeading en="Add photo" hi="फोटो जोड़ें" />
    );

  return (
    <Modal open={open} onClose={handleClose} title={title} busy={submitting} size="lg">
      {!activeBook && (
        <p className="mb-4 text-sm text-amber-700">
          {t({ en: 'Select a book on the Books page first.', hi: 'पहले पुस्तकें पृष्ठ से पुस्तक चुनें।' })}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === 'pick' && (
        <div className="space-y-2">
          <BilingualLine
            en="Choose how to start your next memory."
            hi="अपनी अगली याद कैसे शुरू करें, चुनें।"
            enClass="mb-3 text-sm text-slate-600"
            hiClass="mb-3 text-xs text-slate-500"
          />
          {[
            {
              icon: '🎙️',
              en: 'Record freely',
              hi: 'मुक्त रिकॉर्ड',
              action: () => {
                handleClose();
                navigate('/record');
              },
            },
            {
              icon: '📷',
              en: 'Photo story',
              hi: 'फोटो कहानी',
              action: () => setStep('photo'),
            },
            {
              icon: '📝',
              en: 'Text note',
              hi: 'टेक्स्ट नोट',
              action: () => setStep('text'),
            },
            {
              icon: '✨',
              en: 'Story prompt',
              hi: 'कहानी प्रश्न',
              action: () => {
                handleClose();
                navigate('/prompts');
              },
            },
          ].map((opt) => (
            <button
              key={opt.en}
              type="button"
              className="card flex w-full items-center gap-3 py-3 text-left transition hover:ring-2 hover:ring-brand-200"
              onClick={opt.action}
              disabled={!activeBook && opt.icon !== '✨'}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className={`font-semibold text-brand-700 ${locale === 'hi' ? 'font-hindi' : ''}`}>
                {t({ en: opt.en, hi: opt.hi })}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'text' && (
        <>
          <button type="button" className="mb-3 text-sm text-brand-600" onClick={() => setStep('pick')}>
            ← {t({ en: 'Back', hi: 'वापस' })}
          </button>
          <TextStimulusForm onSubmit={handleTextSubmit} submitting={submitting} />
        </>
      )}

      {step === 'photo' && (
        <>
          <button type="button" className="mb-3 text-sm text-brand-600" onClick={() => setStep('pick')}>
            ← {t({ en: 'Back', hi: 'वापस' })}
          </button>
          <ImageMetadataForm onContinue={handlePhotoSubmit} submitting={submitting} />
        </>
      )}
    </Modal>
  );
}
