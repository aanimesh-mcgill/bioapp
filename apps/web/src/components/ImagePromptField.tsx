import { useCallback } from 'react';
import { BilingualLine } from '@/components/BilingualText';
import { CompactClipRecorder, PromptClipList } from '@/components/PromptClipRecorder';
import { normalizePromptEntry } from '@/lib/imagePrompts';
import { clipsForPrompt } from '@/lib/storyBlocks';
import type { AudioClip, ImagePromptAnswers, ImagePromptEntry, StoryImageBlock } from '@/types';
import {
  uploadPromptClip,
  updateImagePromptEntry,
  deletePromptClip,
} from '@/services/storySessions';
import { deleteBlockClip, uploadBlockPromptClip } from '@/services/storyBlocks';

function clipsForLegacyPrompt(
  allClips: AudioClip[],
  promptKey: keyof ImagePromptAnswers,
  entry: ImagePromptEntry,
): AudioClip[] {
  const fromOrder = (entry.clipOrder ?? [])
    .map((id) => allClips.find((c) => c.id === id && c.errorMessage !== 'removed'))
    .filter(Boolean) as AudioClip[];
  const byKey = allClips.filter(
    (c) => c.errorMessage !== 'removed' && c.promptKey === promptKey,
  );
  const merged: AudioClip[] = [];
  const seen = new Set<string>();
  for (const c of [...fromOrder, ...byKey]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      merged.push(c);
    }
  }
  return merged.sort((a, b) => a.order - b.order);
}

interface ImagePromptFieldProps {
  sessionId: string;
  userId: string;
  promptKey: keyof ImagePromptAnswers;
  label: string;
  labelHi: string;
  entry: ImagePromptEntry;
  /** All clips for the story session */
  clips: AudioClip[];
  imageBlock?: StoryImageBlock;
  onEntryChange: (partial: Partial<ImagePromptEntry>) => void;
}

export function ImagePromptField({
  sessionId,
  userId,
  promptKey,
  label,
  labelHi,
  entry,
  clips: allClips,
  imageBlock,
  onEntryChange,
}: ImagePromptFieldProps) {
  const normalized = normalizePromptEntry(entry);

  const handleClipReady = useCallback(
    async (blob: Blob, duration: number) => {
      if (imageBlock) {
        await uploadBlockPromptClip(userId, sessionId, imageBlock.id, promptKey, blob, duration);
      } else {
        await uploadPromptClip(userId, sessionId, promptKey, blob, duration);
      }
    },
    [userId, sessionId, promptKey, imageBlock],
  );

  const promptClips = imageBlock
    ? clipsForPrompt(allClips, imageBlock, promptKey)
    : clipsForLegacyPrompt(allClips, promptKey, normalized);

  const handleDeleteClip = async (clipId: string) => {
    if (imageBlock) {
      await deleteBlockClip(sessionId, imageBlock.id, clipId);
    } else {
      await deletePromptClip(sessionId, promptKey, clipId);
    }
  };

  const handleDraftBlur = async () => {
    await updateImagePromptEntry(sessionId, promptKey, { draftText: normalized.draftText });
  };

  const handleFinalBlur = async () => {
    await updateImagePromptEntry(sessionId, promptKey, { finalText: normalized.finalText });
  };

  const copyDraftToFinal = () => {
    const next = normalized.draftText ?? '';
    onEntryChange({ finalText: next });
    updateImagePromptEntry(sessionId, promptKey, { finalText: next });
  };

  return (
    <div className="card space-y-3">
      <BilingualLine en={label} hi={labelHi} enClass="text-sm font-medium text-slate-700" hiClass="text-xs text-slate-400" />

      <div>
        <BilingualLine
          en="Draft (type or record — transcriptions append here)"
          hi="ड्राफ्ट (लिखें या रिकॉर्ड करें — प्रतिलेख यहाँ जुड़ेंगे)"
          enClass="text-xs font-semibold text-slate-500"
          hiClass="text-xs text-slate-400"
        />
        <textarea
          className="input-field mt-1 min-h-[72px] text-sm"
          value={normalized.draftText ?? ''}
          onChange={(e) => onEntryChange({ draftText: e.target.value })}
          onBlur={handleDraftBlur}
        />
        <PromptClipList clips={promptClips} onDelete={handleDeleteClip} />
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <CompactClipRecorder autoSave hasExistingClip={promptClips.length > 0} onClipReady={handleClipReady} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <BilingualLine
            en="Final text (readers see this in your book)"
            hi="अंतिम पाठ (पाठक आपकी पुस्तक में यह देखेंगे)"
            enClass="text-xs font-semibold text-slate-500"
            hiClass="text-xs text-slate-400"
          />
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-brand-600"
            onClick={copyDraftToFinal}
          >
            Copy draft → / ड्राफ्ट कॉपी →
          </button>
        </div>
        <textarea
          className="input-field min-h-[72px] text-sm"
          value={normalized.finalText ?? ''}
          onChange={(e) => onEntryChange({ finalText: e.target.value })}
          onBlur={handleFinalBlur}
        />
      </div>
    </div>
  );
}
