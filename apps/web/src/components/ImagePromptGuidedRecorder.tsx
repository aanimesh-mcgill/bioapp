import { useCallback, useState } from 'react';

import { BilingualBtn, BilingualLine } from '@/components/BilingualText';

import { usePickText } from '@/context/UiLocaleContext';

import { ClipRecorder } from '@/components/ClipRecorder';

import { PromptClipList } from '@/components/PromptClipRecorder';

import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';

import { normalizePromptEntry, promptEntryStatus } from '@/lib/imagePrompts';

import { clipsForPrompt } from '@/lib/storyBlocks';

import {

  deleteBlockClip,

  reorderBlockPromptClips,

  updateBlockPromptEntry,

  updateClipLabel,

  uploadBlockPromptClip,

} from '@/services/storyBlocks';

import type { AudioClip, StoryImageBlock } from '@/types';



interface ImagePromptGuidedRecorderProps {

  sessionId: string;

  userId: string;

  block: StoryImageBlock;

  clips: AudioClip[];

  /** Compact layout for use inside modals */

  embedded?: boolean;

  onFinish?: () => void;

  finishing?: boolean;

}



export function PhotoPreview({ block, compact }: { block: StoryImageBlock; compact?: boolean }) {

  return (

    <div

      className={`flex items-center justify-center overflow-hidden rounded-xl bg-heritage-line/40 ${

        compact ? 'max-h-28' : 'max-h-36'

      }`}

    >

      <img

        src={block.imageUrl}

        alt={block.title || 'Photo'}

        className={`w-full object-contain ${compact ? 'max-h-28' : 'max-h-36'}`}

      />

    </div>

  );

}



export function ImagePromptGuidedRecorder({

  sessionId,

  userId,

  block,

  clips,

  embedded,

  onFinish,

  finishing,

}: ImagePromptGuidedRecorderProps) {

  const t = usePickText();
  const prompts = block.prompts ?? {};

  const [promptIndex, setPromptIndex] = useState(0);

  const [toast, setToast] = useState('');



  const current = IMAGE_PROMPT_QUESTIONS[promptIndex];

  const promptClips = clipsForPrompt(clips, block, current.key);



  const showToast = (msg: string) => {

    setToast(msg);

    setTimeout(() => setToast(''), 3500);

  };



  const handleClipReady = useCallback(

    async (blob: Blob, duration: number) => {

      try {

        await uploadBlockPromptClip(userId, sessionId, block.id, current.key, blob, duration);

        showToast(t({ en: 'Clip saved — add more or continue.', hi: 'क्लिप सहेजी — और जोड़ें या आगे बढ़ें।' }));

      } catch {

        showToast(t({ en: 'Failed to save clip. Try again.', hi: 'क्लिप सहेजने में विफल।' }));

        throw new Error('save failed');

      }

    },

    [userId, sessionId, block.id, current.key, t],

  );



  const handleSkip = async () => {

    await updateBlockPromptEntry(sessionId, block.id, current.key, { skipped: true });

    if (promptIndex < IMAGE_PROMPT_QUESTIONS.length - 1) {

      setPromptIndex(promptIndex + 1);

    }

  };



  const handleDeleteClip = async (clipId: string) => {

    await deleteBlockClip(sessionId, block.id, clipId);

  };



  const movePromptClip = async (clipId: string, direction: 'up' | 'down') => {

    const entry = normalizePromptEntry(prompts[current.key]);

    const order = [...(entry.clipOrder ?? [])].filter((id) => {

      const clip = clips.find((c) => c.id === id);

      return clip && clip.errorMessage !== 'removed';

    });

    const idx = order.indexOf(clipId);

    if (idx < 0) return;

    const swap = direction === 'up' ? idx - 1 : idx + 1;

    if (swap < 0 || swap >= order.length) return;

    [order[idx], order[swap]] = [order[swap], order[idx]];

    await reorderBlockPromptClips(sessionId, block.id, current.key, order);

  };



  const statusFor = (key: typeof current.key) => promptEntryStatus(prompts[key]);



  return (

    <div className="space-y-4">

      <PhotoPreview block={block} compact={embedded} />

      {block.title?.trim() && (

        <p className="text-sm font-medium text-heritage-ink">{block.title}</p>

      )}

      {(block.date || block.year) && (

        <p className="text-xs text-heritage-muted">{block.date ?? block.year}</p>

      )}



      <div className="flex flex-wrap gap-1.5">

        {IMAGE_PROMPT_QUESTIONS.map(({ key }, idx) => {

          const status = statusFor(key);

          const isCurrent = idx === promptIndex;

          return (

            <button

              key={key}

              type="button"

              onClick={() => setPromptIndex(idx)}

              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${

                isCurrent

                  ? 'bg-brand-600 text-white'

                  : status === 'answered'

                    ? 'bg-green-100 text-green-800'

                    : status === 'skipped'

                      ? 'bg-amber-100 text-amber-800'

                      : 'bg-slate-100 text-slate-600'

              }`}

            >

              {idx + 1}

              {status === 'answered' ? ' ✓' : status === 'skipped' ? ' —' : ''}

            </button>

          );

        })}

      </div>



      <div className="card border-l-4 border-l-brand-500">

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">

          {t({
            en: `Question ${promptIndex + 1} of ${IMAGE_PROMPT_QUESTIONS.length}`,
            hi: `प्रश्न ${promptIndex + 1} / ${IMAGE_PROMPT_QUESTIONS.length}`,
          })}

        </p>

        <BilingualLine

          en={current.label}

          hi={current.labelHi}

          enClass="mt-2 text-base font-medium text-slate-800"

          hiClass="text-sm text-slate-500"

        />

      </div>



      {toast && (

        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>

      )}



      <PromptClipList

        clips={clips}

        block={block}

        promptKey={current.key}

        onMoveUp={(clipId) => void movePromptClip(clipId, 'up')}

        onMoveDown={(clipId) => void movePromptClip(clipId, 'down')}

        onDelete={handleDeleteClip}

        onLabelChange={(clipId, label) => void updateClipLabel(clipId, label)}

      />



      <div className="rounded-2xl bg-heritage-cream/80 py-2">

        <ClipRecorder

          key={`${block.id}-${current.key}-${promptClips.length}`}

          autoSave

          hasExistingClip={promptClips.length > 0}

          onClipReady={handleClipReady}

        />

      </div>



      <div className="flex flex-wrap gap-2">

        <button

          type="button"

          className="btn-secondary flex-1 text-sm"

          disabled={promptIndex === 0}

          onClick={() => setPromptIndex(promptIndex - 1)}

        >

          <BilingualBtn en="Previous" hi="पिछला" />

        </button>

        <button type="button" className="btn-secondary flex-1 text-sm" onClick={handleSkip}>

          <BilingualBtn en="Skip for now" hi="अभी छोड़ें" />

        </button>

        <button

          type="button"

          className="btn-primary flex-1 text-sm"

          disabled={promptIndex >= IMAGE_PROMPT_QUESTIONS.length - 1}

          onClick={() => setPromptIndex(promptIndex + 1)}

        >

          <BilingualBtn en="Next" hi="अगला" />

        </button>

      </div>



      {onFinish && (
        <button
          type="button"
          className={embedded ? 'btn-secondary w-full' : 'btn-primary w-full'}
          onClick={onFinish}
          disabled={finishing}
        >
          {finishing ? (
            <BilingualBtn en="Submitting…" hi="जमा हो रहा…" />
          ) : embedded ? (
            <BilingualBtn en="Done" hi="हो गया" />
          ) : (
            <BilingualBtn en="Finish & Save Story" hi="समाप्त करें और कहानी सहेजें" />
          )}
        </button>
      )}

    </div>

  );

}


