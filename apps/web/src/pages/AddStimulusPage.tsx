import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageHeading, PageSubheading } from '@/components/BilingualText';
import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';
import { PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';
import { createStorySession } from '@/services/storySessions';
import { addImageBlock, addTextBlock } from '@/services/storyBlocks';

export function AddStimulusPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const prefs = profile?.preferences;

  const handleTextSubmit = async (data: { content: string; date?: string; year?: number }) => {
    setSubmitting(true);
    try {
      const id = await createStorySession({
        userId: user.uid,
        title: data.content.slice(0, 50) + (data.content.length > 50 ? '…' : ''),
        sourceType: 'text_stimulus',
        languageHint: prefs?.defaultLanguage ?? 'mixed',
        hindiOutputMode: prefs?.hindiOutputMode ?? 'hindi_script',
        perspective: prefs?.storyPerspective ?? 'first',
      });
      await addTextBlock(id, data);
      navigate(`/story/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageContinue = async (data: {
    file: File;
    date?: string;
    year?: number;
  }) => {
    setSubmitting(true);
    setError('');
    try {
      const id = await createStorySession({
        userId: user.uid,
        title: PHOTO_STORY_PLACEHOLDER,
        sourceType: 'image_stimulus',
        languageHint: prefs?.defaultLanguage ?? 'mixed',
        hindiOutputMode: prefs?.hindiOutputMode ?? 'hindi_script',
        perspective: prefs?.storyPerspective ?? 'first',
      });
      await addImageBlock(user.uid, id, { ...data, title: '' });
      navigate(`/story/${id}`);
    } catch (err) {
      console.error(err);
      setError('Could not save photo. Try again. / फोटो सहेज नहीं सके। फिर कोशिश करें।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <PageHeading en="Add Stimulus" hi="उद्दीपक जोड़ें" />
      <PageSubheading
        en="Add photos and text notes to build a story — each section can have its own recordings."
        hi="कहानी बनाने के लिए फोटो और टेक्स्ट जोड़ें — प्रत्येक अनुभाग की अपनी रिकॉर्डिंग हो सकती है।"
      />

      <div className="mb-6 flex gap-2">
        {(['text', 'image'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              mode === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setMode(m)}
          >
            {m === 'text' ? '📝 Text / टेक्स्ट' : '📷 Photo / फोटो'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {mode === 'text' ? (
        <TextStimulusForm onSubmit={handleTextSubmit} submitting={submitting} />
      ) : (
        <ImageMetadataForm onContinue={handleImageContinue} submitting={submitting} />
      )}
    </div>
  );
}
