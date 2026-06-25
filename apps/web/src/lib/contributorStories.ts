import { resolveStoryBlocks, storyClipCount } from '@/lib/storyBlocks';
import type { StorySession } from '@/types';
import type { usePickText } from '@/context/UiLocaleContext';

/** Contributor has finished and submitted — no further self-edits (author may reject to reopen). */
export function isContributorStorySubmitted(story: Pick<StorySession, 'isContributorStory' | 'contributorSubmitted' | 'status'>): boolean {
  if (!story.isContributorStory) return false;
  if (story.status === 'rejected') return false;
  if (story.contributorSubmitted) return true;
  return story.status !== 'recording';
}

export function isContributorStoryEditable(story: Pick<StorySession, 'isContributorStory' | 'contributorSubmitted' | 'status'>): boolean {
  if (!story.isContributorStory) return false;
  return !isContributorStorySubmitted(story);
}

export function contributorStoryHref(
  inviteSlug: string,
  story: Pick<StorySession, 'id' | 'status' | 'isContributorStory' | 'contributorSubmitted'>,
): string {
  if (isContributorStoryEditable(story)) {
    return `/contribute/${inviteSlug}/story/${story.id}`;
  }
  return `/stories/${story.id}`;
}

export function contributorStoryThumb(story: StorySession): string | null {
  const { order, blocks } = resolveStoryBlocks(story);
  for (const id of order) {
    const b = blocks[id];
    if (b?.type === 'image' && b.imageUrl) return b.imageUrl;
  }
  return story.imageStimulus?.imageUrl ?? null;
}

export function contributorStoryMeta(story: StorySession, t: ReturnType<typeof usePickText>): string {
  const clipCount = storyClipCount(story);
  const parts: string[] = [];
  if (clipCount > 0) {
    parts.push(`${clipCount} ${t({ en: clipCount === 1 ? 'clip' : 'clips', hi: 'क्लिप' })}`);
  }
  parts.push(story.updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  return parts.join(' · ');
}

export function contributorStoryMatchesBook(
  story: Pick<StorySession, 'isContributorStory' | 'bookId'>,
  collabBookId: string,
  albumBookId?: string | null,
): boolean {
  if (!story.isContributorStory || !story.bookId) return false;
  if (story.bookId === collabBookId) return true;
  return Boolean(albumBookId && story.bookId === albumBookId);
}
