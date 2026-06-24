import { useCallback, useState } from 'react';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { ClipRecorder } from '@/components/ClipRecorder';
import { PromptClipList } from '@/components/PromptClipRecorder';
import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import { promptEntryStatus } from '@/lib/imagePrompts';
import { clipsForPrompt } from '@/lib/storyBlocks';
import {
  deleteBlockClip,
  updateBlockPromptEntry,
  uploadBlockPromptClip,
} from '@/services/storyBlocks';
import type { AudioClip, StoryImageBlock } from '@/types';

interface ImagePromptGuidedRecorderProps {
  sessionId: string;
  userId: string;
  block: StoryImageBlock;
  clips: AudioClip[];
  embedded?: boolean;
  onFinish?: () => void;
  finishing?: boolean;
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
        showToast('Clip saved — add more or continue. / क्लिप सहेजी — और जोड़ें या आगे बढ़ें।');
      } catch {
        showToast('Failed to save clip. Try again. / क्लिप सहेजने में विफल।');
        throw new Error('save failed');
      }
    },
    [userId, sessionId, block.id, current.key],
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

  const statusFor = (key: typeof current.key) => promptEntryStatus(prompts[key]);

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="card sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
          <img
            src={block.imageUrl}
            alt={block.title}
            className="mb-2 max-h-[40vh] w-full rounded-xl object-contain"
          />
          <p className="font-semibold text-slate-800">{block.title}</p>
          {(block.date || block.year) && (
            <p className="text-xs text-slate-500">{block.date ?? block.year}</p>
          )}
        </div>
      )}

      {embedded && (
        <img
          src={block.imageUrl}
          alt={block.title}
          className="max-h-[35vh] w-full rounded-xl object-contain"
        />
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
          Question {promptIndex + 1} of {IMAGE_PROMPT_QUESTIONS.length} / प्रश्न {promptIndex + 1} / {IMAGE_PROMPT_QUESTIONS.length}
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

      <PromptClipList clips={promptClips} onDelete={handleDeleteClip} />

      <div className="my-4">
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

      {!embedded && onFinish && (
        <button type="button" className="btn-primary w-full" onClick={onFinish} disabled={finishing}>
          {finishing ? (
            <BilingualBtn en="Submitting…" hi="जमा हो रहा…" />
          ) : (
            <BilingualBtn en="Finish & Save Story" hi="समाप्त करें और कहानी सहेजें" />
          )}
        </button>
      )}
    </div>
  );
}
