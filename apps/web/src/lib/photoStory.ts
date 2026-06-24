import { resolveStoryBlocks } from '@/lib/storyBlocks';
import type { StorySession } from '@/types';

export const PHOTO_STORY_PLACEHOLDER = 'Untitled photo';

export function isPlaceholderPhotoTitle(title: string | undefined): boolean {
  if (!title?.trim()) return true;
  if (title === PHOTO_STORY_PLACEHOLDER) return true;
  if (title.endsWith(`— ${PHOTO_STORY_PLACEHOLDER}`)) return true;
  if (title.endsWith('— Photo story')) return true;
  return false;
}

export function sessionHasPhotoContent(session: StorySession): boolean {
  if (session.sourceType === 'image_stimulus') return true;
  const { order, blocks } = resolveStoryBlocks(session);
  return order.some((id) => blocks[id]?.type === 'image');
}

export function shouldPromptPhotoStoryName(session: StorySession): boolean {
  return sessionHasPhotoContent(session) && isPlaceholderPhotoTitle(session.title);
}
