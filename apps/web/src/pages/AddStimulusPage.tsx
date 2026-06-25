import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText } from '@/context/UiLocaleContext';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';
import { PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';
import { createStoryInBook } from '@/services/bookStructure';
import { userDisplayName } from '@/lib/userDisplayName';
import { addImageBlock, addTextBlock } from '@/services/storyBlocks';

function modeFromQuery(raw: string | null): 'text' | 'image' {
  if (raw === 'photo' || raw === 'image') return 'image';
  return 'text';
}

export function AddStimulusPage() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = usePickText();
  const [mode, setMode] = useState<'text' | 'image'>(() => modeFromQuery(searchParams.get('mode')));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(modeFromQuery(searchParams.get('mode')));
  }, [searchParams]);

  if (!user) return null;

  const prefs = profile?.preferences;
  const authorName = userDisplayName(user, profile);

  const handleTextSubmit = async (data: { content: string; date?: string; year?: number }) => {
    setSubmitting(true);
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
      navigate(`/story/${id}`);
    } catch (err) {
      console.error(err);
      setError(t({ en: 'Could not save photo. Try again.', hi: 'फोटो सहेज नहीं सके। फिर कोशिश करें।' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="heritage-page">
      <HeritagePageTitle
        en={mode === 'image' ? 'Add a photo' : 'Write a note'}
        hi={mode === 'image' ? 'फोटो जोड़ें' : 'नोट लिखें'}
        subtitle={{
          en: 'Build your story one piece at a time.',
          hi: 'अपनी कहानी एक-एक करके बनाएं।',
        }}
      />

      <div className="mb-6 flex gap-2">
        {(['text', 'image'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              mode === m ? 'bg-brand-600 text-white' : 'bg-heritage-paper text-heritage-muted ring-1 ring-heritage-line'
            }`}
            onClick={() => setMode(m)}
          >
            {m === 'text' ? t({ en: 'Write', hi: 'लिखें' }) : t({ en: 'Photo', hi: 'तस्वीर' })}
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
