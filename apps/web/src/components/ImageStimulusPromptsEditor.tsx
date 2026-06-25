import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeading, BilingualBtn, T } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { ImagePromptField } from '@/components/ImagePromptField';
import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import { mergeImagePromptAnswers, normalizePromptEntry } from '@/lib/imagePrompts';
import { resolveStoryBlocks } from '@/lib/storyBlocks';
import {
  subscribeToSession,
  subscribeToClips,
  saveAllImagePrompts,
} from '@/services/storySessions';
import type { ImagePromptAnswers, ImageStimulusData, StorySession, AudioClip, StoryImageBlock } from '@/types';

interface ImageStimulusPromptsEditorProps {
  sessionId: string;
  userId: string;
  onBack?: () => void;
  donePath?: string;
  showImagePreview?: boolean;
  onSaved?: () => void;
}

function mergedImagePrompts(session: StorySession): ImagePromptAnswers {
  const { order, blocks } = resolveStoryBlocks(session);
  const imageBlock = order.map((id) => blocks[id]).find((b) => b?.type === 'image') as
    | StoryImageBlock
    | undefined;
  const legacy = session.imageStimulus?.prompts ?? {};
  if (imageBlock) {
    return mergeImagePromptAnswers(imageBlock.prompts ?? {}, legacy);
  }
  return legacy;
}

function firstImageBlock(session: StorySession): StoryImageBlock | undefined {
  const { order, blocks } = resolveStoryBlocks(session);
  return order.map((id) => blocks[id]).find((b) => b?.type === 'image') as StoryImageBlock | undefined;
}

export function ImageStimulusPromptsEditor({
  sessionId,
  userId,
  onBack,
  donePath = '/stories',
  showImagePreview = true,
  onSaved,
}: ImageStimulusPromptsEditorProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<StorySession | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [prompts, setPrompts] = useState<ImagePromptAnswers>({});
  const [imageBlock, setImageBlock] = useState<StoryImageBlock | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeToSession(sessionId, (s) => {
      setSession(s);
      if (s) {
        setPrompts(mergedImagePrompts(s));
        setImageBlock(firstImageBlock(s));
      }
    });
  }, [sessionId]);

  useEffect(() => {
    return subscribeToClips(sessionId, setClips);
  }, [sessionId]);

  const imageStimulus = session?.imageStimulus;
  const displayStimulus: ImageStimulusData | null =
    imageStimulus ??
    (imageBlock
      ? {
          title: imageBlock.title,
          imageUrl: imageBlock.imageUrl,
          imageStoragePath: imageBlock.imageStoragePath,
          date: imageBlock.date,
          year: imageBlock.year,
          prompts: prompts,
        }
      : null);

  const handleEntryChange = (key: keyof ImagePromptAnswers, partial: Partial<ReturnType<typeof normalizePromptEntry>>) => {
    setPrompts((prev) => ({
      ...prev,
      [key]: { ...normalizePromptEntry(prev[key]), ...partial },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAllImagePrompts(sessionId, prompts);
      if (onSaved) onSaved();
      else navigate(donePath);
    } finally {
      setSaving(false);
    }
  };

  const t = usePickText();

  if (!session || !displayStimulus) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <button type="button" className="text-sm text-brand-600" onClick={onBack}>
          ← {t({ en: 'Back', hi: 'वापस' })}
        </button>
      )}

      {showImagePreview && <ImagePreview imageStimulus={displayStimulus} />}

      <SectionHeading
        en="Tell us about this photo"
        hi="इस फोटो के बारे में बताएं"
      />

      {IMAGE_PROMPT_QUESTIONS.map(({ key, label, labelHi }) => {
        const entry = normalizePromptEntry(prompts[key]);

        return (
          <ImagePromptField
            key={key}
            sessionId={sessionId}
            userId={userId}
            promptKey={key}
            label={label}
            labelHi={labelHi}
            entry={entry}
            clips={clips}
            imageBlock={imageBlock}
            onEntryChange={(partial) => handleEntryChange(key, partial)}
          />
        );
      })}

      <button type="button" className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? (
          <BilingualBtn en="Saving…" hi="सहेज रहे हैं…" />
        ) : (
          <BilingualBtn en="Save Story" hi="कहानी सहेजें" />
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        <T en="Recordings auto-save — listen above each prompt" hi="रिकॉर्डिंग स्वचालित सहेजी जाती है — प्रत्येक प्रश्न के ऊपर सुनें" />
      </p>
    </div>
  );
}

function ImagePreview({ imageStimulus }: { imageStimulus: ImageStimulusData }) {
  return (
    <div className="card">
      <img
        src={imageStimulus.imageUrl}
        alt={imageStimulus.title || 'Photo'}
        className="mx-auto mb-2 max-h-40 w-full rounded-xl object-contain"
      />
      {imageStimulus.title?.trim() && (
        <p className="font-semibold text-slate-800">{imageStimulus.title}</p>
      )}
      {(imageStimulus.date || imageStimulus.year) && (
        <p className="text-xs text-slate-500">{imageStimulus.date ?? imageStimulus.year}</p>
      )}
    </div>
  );
}
