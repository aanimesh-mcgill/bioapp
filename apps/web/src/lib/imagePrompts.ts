import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import type { ImagePromptAnswers, ImagePromptEntry, ImageStimulusData } from '@/types';

export function emptyPromptEntry(): ImagePromptEntry {
  return { draftText: '', finalText: '', clipOrder: [] };
}

/** Normalize legacy string values to ImagePromptEntry */
export function normalizePromptEntry(value: ImagePromptEntry | string | undefined): ImagePromptEntry {
  if (!value) return emptyPromptEntry();
  if (typeof value === 'string') {
    return { draftText: value, finalText: value, clipOrder: [] };
  }
  return {
    draftText: value.draftText ?? '',
    finalText: value.finalText ?? '',
    clipOrder: value.clipOrder ?? [],
    skipped: value.skipped,
  };
}

export function composeImageStoryReaderText(imageStimulus: ImageStimulusData): string {
  return IMAGE_PROMPT_QUESTIONS.map(({ key, label, labelHi }) => {
    const entry = normalizePromptEntry(imageStimulus.prompts[key]);
    const text = entry.finalText?.trim();
    if (!text) return '';
    return `${label}\n${labelHi}\n${text}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

export function promptEntryStatus(entry: ImagePromptEntry | string | undefined): 'empty' | 'skipped' | 'answered' {
  const e = normalizePromptEntry(entry);
  if (e.skipped) return 'skipped';
  if ((e.clipOrder?.length ?? 0) > 0 || e.draftText?.trim() || e.finalText?.trim()) return 'answered';
  return 'empty';
}

export function firstIncompletePromptIndex(prompts: ImagePromptAnswers): number {
  const idx = IMAGE_PROMPT_QUESTIONS.findIndex(({ key }) => promptEntryStatus(prompts[key]) === 'empty');
  return idx >= 0 ? idx : IMAGE_PROMPT_QUESTIONS.length - 1;
}

export function hasAnyPromptContent(prompts: ImagePromptAnswers): boolean {
  return IMAGE_PROMPT_QUESTIONS.some(({ key }) => promptEntryStatus(prompts[key]) !== 'empty');
}

export function mergePromptAnswers(
  current: ImagePromptAnswers,
  key: keyof ImagePromptAnswers,
  partial: Partial<ImagePromptEntry>,
): ImagePromptAnswers {
  const entry = { ...normalizePromptEntry(current[key]), ...partial };
  return { ...current, [key]: entry };
}

/** Merge two prompt entries — unions clip IDs, prefers non-empty text from either side. */
export function mergePromptEntry(
  a: ImagePromptEntry | string | undefined,
  b: ImagePromptEntry | string | undefined,
): ImagePromptEntry {
  const aN = normalizePromptEntry(a);
  const bN = normalizePromptEntry(b);
  const clipOrder: string[] = [];
  for (const id of [...(aN.clipOrder ?? []), ...(bN.clipOrder ?? [])]) {
    if (!clipOrder.includes(id)) clipOrder.push(id);
  }
  return {
    draftText: aN.draftText?.trim() ? aN.draftText : bN.draftText,
    finalText: aN.finalText?.trim() ? aN.finalText : bN.finalText,
    clipOrder,
    skipped: clipOrder.length === 0 && Boolean(aN.skipped && bN.skipped),
  };
}

export function mergeImagePromptAnswers(a: ImagePromptAnswers = {}, b: ImagePromptAnswers = {}): ImagePromptAnswers {
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
    ...IMAGE_PROMPT_QUESTIONS.map((q) => q.key),
  ]) as Set<keyof ImagePromptAnswers>;
  const merged: ImagePromptAnswers = {};
  for (const key of keys) {
    merged[key] = mergePromptEntry(a[key], b[key]);
  }
  return merged;
}
