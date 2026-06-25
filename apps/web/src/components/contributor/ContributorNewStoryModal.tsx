import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { BilingualBtn, BilingualLine, SectionHeading } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';
import { contributorSessionBase } from '@/lib/contributorSession';
import { PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';
import { addImageBlock, addTextBlock } from '@/services/storyBlocks';
import { createStorySession } from '@/services/storySessions';
import type { ContributorInvite } from '@/types';

interface ContributorNewStoryModalProps {
  open: boolean;
  onClose: () => void;
  invite: ContributorInvite;
}

type Step = 'pick' | 'text' | 'photo';

export function ContributorNewStoryModal({ open, onClose, invite }: ContributorNewStoryModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [step, setStep] = useState<Step>('pick');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const prefs = profile?.preferences;
  const base = contributorSessionBase(user!.uid, invite);

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

  const goToStory = (sessionId: string) => {
    handleClose();
    navigate(`/contribute/${invite.inviteSlug}/story/${sessionId}`);
  };

  const handleTextSubmit = async (data: { content: string; date?: string; year?: number }) => {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const id = await createStorySession({
        ...base,
        title: data.content.slice(0, 50) + (data.content.length > 50 ? '…' : ''),
        sourceType: 'text_stimulus',
      });
      await addTextBlock(id, data);
      goToStory(id);
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
      const id = await createStorySession({
        ...base,
        title: PHOTO_STORY_PLACEHOLDER,
        sourceType: 'image_stimulus',
      });
      await addImageBlock(user.uid, id, { ...data, title: '' });
      goToStory(id);
    } catch {
      setError(t({ en: 'Could not save photo.', hi: 'फोटो सहेज नहीं सके।' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecord = async () => {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const id = await createStorySession({
        ...base,
        title: t({ en: 'New memory', hi: 'नई याद' }),
        sourceType: 'freeform',
      });
      goToStory(id);
    } catch {
      setError(t({ en: 'Could not create story.', hi: 'कहानी नहीं बन सकी।' }));
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
      <BilingualLine
        en={`For ${invite.ownerName}'s book "${invite.bookTitle}"`}
        hi={`${invite.ownerName} की पुस्तक "${invite.bookTitle}" के लिए`}
        enClass="mb-3 text-sm text-slate-600"
        hiClass="mb-3 text-xs text-slate-500"
      />

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === 'pick' && (
        <div className="space-y-2">
          <BilingualLine
            en="Choose how to start your memory — same as adding a story to your own book."
            hi="अपनी याद कैसे शुरू करें चुनें — अपनी पुस्तक में कहानी जोड़ने जैसा।"
            enClass="mb-3 text-sm text-slate-600"
            hiClass="mb-3 text-xs text-slate-500"
          />
          {[
            { icon: '🎙️', en: 'Record freely', hi: 'मुक्त रिकॉर्ड', action: handleRecord },
            { icon: '📷', en: 'Photo story', hi: 'फोटो कहानी', action: () => setStep('photo') },
            { icon: '📝', en: 'Text note', hi: 'टेक्स्ट नोट', action: () => setStep('text') },
          ].map((opt) => (
            <button
              key={opt.en}
              type="button"
              className="card flex w-full items-center gap-3 py-3 text-left transition hover:ring-2 hover:ring-brand-200"
              onClick={opt.action}
              disabled={submitting}
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
