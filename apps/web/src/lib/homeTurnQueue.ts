import type { PromptLike } from '@/data/stimuli';
import { getNextInQueue } from '@/lib/turnQueue';
import type { BookPhoto } from '@/types';

function photoIsReady(photo: BookPhoto): boolean {
  return !!photo.imageStoragePath?.trim();
}

export function photoTurnKey(photoId: string): string {
  return `photo:${photoId}`;
}

export function promptTurnKey(promptId: string): string {
  return `prompt:${promptId}`;
}

export type HomeTurn =
  | { type: 'photo'; key: string; photo: BookPhoto }
  | { type: 'prompt'; key: string; prompt: PromptLike };

export function buildHomeTurnItems(
  photos: BookPhoto[],
  prompts: PromptLike[],
  completedPromptIds: string[],
): HomeTurn[] {
  const items: HomeTurn[] = [];

  for (const photo of [...photos]
    .filter((p) => photoIsReady(p) && p.status === 'pending')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    items.push({ type: 'photo', key: photoTurnKey(photo.id), photo });
  }

  const completed = new Set(completedPromptIds);
  for (const prompt of [...prompts].sort((a, b) => a.order - b.order)) {
    if (!completed.has(prompt.id)) {
      items.push({ type: 'prompt', key: promptTurnKey(prompt.id), prompt });
    }
  }

  return items;
}

export function getNextHomeTurn(
  photos: BookPhoto[],
  prompts: PromptLike[],
  completedPromptIds: string[],
  skippedTurnIds: string[],
): HomeTurn | null {
  const inProgress = photos.find(
    (p) =>
      p.status === 'in_progress' &&
      photoIsReady(p) &&
      !skippedTurnIds.includes(photoTurnKey(p.id)),
  );
  if (inProgress) {
    return { type: 'photo', key: photoTurnKey(inProgress.id), photo: inProgress };
  }

  const items = buildHomeTurnItems(photos, prompts, completedPromptIds);
  const next = getNextInQueue(
    items.map((item) => ({ id: item.key })),
    [],
    skippedTurnIds,
  );
  if (!next) return null;
  return items.find((item) => item.key === next.id) ?? null;
}

export function countHomeQueueItems(
  photos: BookPhoto[],
  prompts: PromptLike[],
  completedPromptIds: string[],
): number {
  const inProgress = photos.some((p) => p.status === 'in_progress' && photoIsReady(p));
  const pending = buildHomeTurnItems(photos, prompts, completedPromptIds).length;
  return pending + (inProgress ? 1 : 0);
}

export function canGoPreviousTurn(skippedTurnIds: string[]): boolean {
  return skippedTurnIds.length > 0;
}

export function effectiveSkippedTurnIds(progress: {
  skippedTurnIds?: string[];
  skippedPromptIds?: string[];
  skippedPhotoIds?: string[];
}): string[] {
  if (progress.skippedTurnIds?.length) return progress.skippedTurnIds;
  return [
    ...((progress.skippedPhotoIds ?? []).map((id) => photoTurnKey(id))),
    ...((progress.skippedPromptIds ?? []).map((id) => promptTurnKey(id))),
  ];
}
