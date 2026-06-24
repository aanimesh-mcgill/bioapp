import type { StorySession } from '@/types';
import { blockTimelineMs, resolveStoryBlocks } from '@/lib/storyBlocks';

/** Sort key: first block date/year if present, else legacy fields, else story creation time. */
export function storyTimelineMs(story: StorySession): number {
  const { order, blocks } = resolveStoryBlocks(story);
  if (order.length > 0) {
    let earliest = story.createdAt.getTime();
    for (const id of order) {
      const block = blocks[id];
      if (block) {
        earliest = Math.min(earliest, blockTimelineMs(block, story.createdAt.getTime()));
      }
    }
    return earliest;
  }

  const img = story.imageStimulus;
  if (img?.date) {
    const t = Date.parse(img.date);
    if (!Number.isNaN(t)) return t;
  }
  if (img?.year) return Date.UTC(img.year, 0, 1);

  const txt = story.textStimulus;
  if (txt?.date) {
    const t = Date.parse(txt.date);
    if (!Number.isNaN(t)) return t;
  }
  if (txt?.year) return Date.UTC(txt.year, 0, 1);

  return story.createdAt.getTime();
}

export function compareStoriesByTimeline(a: StorySession, b: StorySession): number {
  const diff = storyTimelineMs(a) - storyTimelineMs(b);
  if (diff !== 0) return diff;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function sortStoriesByTimeline(stories: StorySession[]): StorySession[] {
  return [...stories].sort(compareStoriesByTimeline);
}

/** Index to insert `story` into an ordered list sorted by timeline. */
export function timelineInsertIndex(story: StorySession, orderedIds: string[], byId: Map<string, StorySession>): number {
  const key = storyTimelineMs(story);
  let index = orderedIds.length;
  for (let i = 0; i < orderedIds.length; i++) {
    const other = byId.get(orderedIds[i]);
    if (other && storyTimelineMs(other) > key) {
      index = i;
      break;
    }
  }
  return index;
}
