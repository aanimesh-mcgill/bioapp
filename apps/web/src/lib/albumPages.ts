import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import { composeImageStoryReaderText, normalizePromptEntry } from '@/lib/imagePrompts';
import { blockClipIds, imageBlockAsStimulus, imageBlockClipOrder, resolveStoryBlocks } from '@/lib/storyBlocks';
import type { AudioClip, Book, Chapter, StoryContentBlock, StorySession } from '@/types';

export type AlbumPageKind = 'cover' | 'toc' | 'chapter' | 'spread';

export interface AlbumSpread {
  kind: AlbumPageKind;
  chapterTitle?: string;
  storyTitle?: string;
  storyId?: string;
  blockId?: string;
  blockType?: 'image' | 'text';
  imageUrl?: string;
  imageStoragePath?: string;
  imageTitle?: string;
  dateLabel?: string;
  bodyText?: string;
  clipIds: string[];
  contributorName?: string;
  contributorRelationship?: string;
  statusLabel?: string;
}

const PUBLIC_STATUSES = new Set(['ready', 'pending_approval', 'approved']);

function clipsForSpread(page: AlbumSpread, clips: AudioClip[]): AudioClip[] {
  if (page.clipIds.length === 0) return clips.filter((c) => c.audioUrl);
  const order = new Map(page.clipIds.map((id, i) => [id, i]));
  return clips
    .filter((c) => order.has(c.id) && c.audioUrl)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** True when a spread has something visible in the PDF (image, text, or listenable clips). */
export function spreadHasRenderableContent(page: AlbumSpread, clips: AudioClip[]): boolean {
  if (page.kind !== 'spread') return true;
  const hasImage = Boolean(page.imageUrl?.trim());
  const hasBody = Boolean(page.bodyText?.trim());
  const hasAudio = clipsForSpread(page, clips).length > 0;
  return hasImage || hasBody || hasAudio;
}

/** Drop empty spreads and chapter dividers with no story pages after them. */
export function filterBlankAlbumPages(
  pages: AlbumSpread[],
  clipsByStory: Record<string, AudioClip[]>,
): AlbumSpread[] {
  const spreadsWithContent = new Set<number>();
  pages.forEach((page, index) => {
    if (page.kind !== 'spread' || !page.storyId) return;
    const clips = clipsByStory[page.storyId] ?? [];
    if (spreadHasRenderableContent(page, clips)) spreadsWithContent.add(index);
  });

  const filtered: AlbumSpread[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (page.kind === 'cover' || page.kind === 'toc') {
      filtered.push(page);
      continue;
    }
    if (page.kind === 'chapter') {
      let hasFollowingSpread = false;
      for (let j = i + 1; j < pages.length; j++) {
        if (pages[j].kind === 'chapter') break;
        if (spreadsWithContent.has(j)) {
          hasFollowingSpread = true;
          break;
        }
      }
      if (hasFollowingSpread) filtered.push(page);
      continue;
    }
    if (page.kind === 'spread' && spreadsWithContent.has(i)) {
      filtered.push(page);
    }
  }
  return filtered;
}

function dateLabel(block: StoryContentBlock): string | undefined {
  if (block.date) return block.date;
  if (block.year) return String(block.year);
  return undefined;
}

function blockBodyText(block: StoryContentBlock, story: StorySession, clips: AudioClip[]): string {
  if (block.type === 'text') {
    const parts = [block.content.trim()];
    for (const clipId of block.clipOrder) {
      const t = clips.find((c) => c.id === clipId)?.transcript?.text?.trim();
      if (t) parts.push(t);
    }
    return parts.filter(Boolean).join('\n\n');
  }

  const stimulus = imageBlockAsStimulus(block);
  const fromFinal = composeImageStoryReaderText(stimulus);
  if (fromFinal) return fromFinal;

  const draftParts: string[] = [];
  for (const { key, label } of IMAGE_PROMPT_QUESTIONS) {
    const entry = normalizePromptEntry(block.prompts[key]);
    const text = entry.finalText?.trim() || entry.draftText?.trim();
    if (text) draftParts.push(`${label}\n${text}`);
  }
  if (draftParts.length) return draftParts.join('\n\n');

  for (const clipId of blockClipIds(block)) {
    const t = clips.find((c) => c.id === clipId)?.transcript?.text?.trim();
    if (t) draftParts.push(t);
  }
  return draftParts.join('\n\n');
}

function storyFallbackText(story: StorySession, clips: AudioClip[]): string {
  return (
    story.editedDraft?.trim() ||
    story.draft?.trim() ||
    story.editedTranscript?.trim() ||
    story.combinedTranscript?.text?.trim() ||
    clips
      .map((c) => c.transcript?.text?.trim())
      .filter(Boolean)
      .join('\n\n') ||
    ''
  );
}

function spreadsForStory(
  story: StorySession,
  clips: AudioClip[],
  chapterTitle: string | undefined,
  preview: boolean,
): AlbumSpread[] {
  if (!preview && !PUBLIC_STATUSES.has(story.status)) return [];

  const { order, blocks } = resolveStoryBlocks(story);
  const statusLabel =
    preview && !PUBLIC_STATUSES.has(story.status) ? story.status.replace('_', ' ') : undefined;

  const base = {
    storyTitle: story.title,
    storyId: story.id,
    chapterTitle,
    contributorName: story.contributorName,
    contributorRelationship: story.contributorRelationship,
    statusLabel,
  };

  if (order.length === 0) {
    const body = storyFallbackText(story, clips);
    const hasImage = Boolean(story.imageStimulus?.imageUrl);
    const spread: AlbumSpread = {
      kind: 'spread',
      ...base,
      blockType: hasImage ? 'image' : 'text',
      imageUrl: story.imageStimulus?.imageUrl,
      imageStoragePath: story.imageStimulus?.imageStoragePath,
      imageTitle: story.imageStimulus?.title ?? story.title,
      dateLabel: story.imageStimulus?.date ?? (story.imageStimulus?.year ? String(story.imageStimulus.year) : story.textStimulus?.date ?? (story.textStimulus?.year ? String(story.textStimulus.year) : undefined)),
      bodyText: body || story.textStimulus?.content || '',
      clipIds: story.clipOrder.length ? story.clipOrder : clips.map((c) => c.id),
    };
    return spreadHasRenderableContent(spread, clips) ? [spread] : [];
  }

  return order
    .map((blockId) => blocks[blockId])
    .filter(Boolean)
    .map((block) => ({
      kind: 'spread' as const,
      ...base,
      blockId: block.id,
      blockType: block.type,
      imageUrl: block.type === 'image' ? block.imageUrl : undefined,
      imageStoragePath: block.type === 'image' ? block.imageStoragePath : undefined,
      imageTitle: block.type === 'image' ? block.title : undefined,
      dateLabel: dateLabel(block),
      bodyText:
        blockBodyText(block, story, clips) ||
        (block.type === 'text' ? block.content : '') ||
        (block.type === 'image' ? block.title?.trim() : '') ||
        '',
      clipIds:
        block.type === 'image'
          ? imageBlockClipOrder(
              block,
              clips.filter((c) => c.blockId === block.id && c.errorMessage !== 'removed'),
            )
          : block.clipOrder,
    }))
    .filter((spread) => spreadHasRenderableContent(spread, clips));
}

export const MORE_STORIES_CHAPTER_TITLE = '__more_stories__';

export function displayChapterTitle(
  title: string | undefined,
  t: (b: { en: string; hi: string }) => string,
): string {
  if (!title) return '';
  if (title === MORE_STORIES_CHAPTER_TITLE || title === 'More Stories / और कहानियाँ') {
    return t({ en: 'More Stories', hi: 'और कहानियाँ' });
  }
  return title;
}

export function buildAlbumPages(
  book: Book,
  chapters: Chapter[],
  stories: StorySession[],
  clipsByStory: Record<string, AudioClip[]>,
  options: { preview?: boolean } = {},
): AlbumSpread[] {
  const preview = options.preview ?? false;
  const pages: AlbumSpread[] = [
    { kind: 'cover', clipIds: [] },
    { kind: 'toc', clipIds: [] },
  ];

  const orderedChapters = book.chapterOrder
    .map((id) => chapters.find((c) => c.id === id))
    .filter(Boolean) as Chapter[];

  for (const chapter of orderedChapters) {
    pages.push({ kind: 'chapter', chapterTitle: chapter.title, clipIds: [] });
    for (const storyId of chapter.storyOrder) {
      const story = stories.find((s) => s.id === storyId);
      if (!story) continue;
      const clips = (clipsByStory[story.id] ?? []).sort((a, b) => a.order - b.order);
      pages.push(...spreadsForStory(story, clips, chapter.title, preview));
    }
  }

  const assigned = new Set(orderedChapters.flatMap((c) => c.storyOrder));
  const extra = stories.filter((s) => s.bookId === book.id && !assigned.has(s.id));
  if (extra.length > 0) {
    pages.push({ kind: 'chapter', chapterTitle: MORE_STORIES_CHAPTER_TITLE, clipIds: [] });
    for (const story of extra) {
      const clips = (clipsByStory[story.id] ?? []).sort((a, b) => a.order - b.order);
      pages.push(...spreadsForStory(story, clips, undefined, preview));
    }
  }

  return filterBlankAlbumPages(pages, clipsByStory);
}

export function indexClipsByStory(clips: AudioClip[]): Record<string, AudioClip[]> {
  const map: Record<string, AudioClip[]> = {};
  for (const clip of clips) {
    if (clip.errorMessage === 'removed') continue;
    if (!map[clip.storySessionId]) map[clip.storySessionId] = [];
    map[clip.storySessionId].push(clip);
  }
  for (const sid of Object.keys(map)) {
    map[sid].sort((a, b) => a.order - b.order);
  }
  return map;
}

export function resolveSpreadPageIndex(
  pages: AlbumSpread[],
  params: { storyId?: string | null; blockId?: string | null; page?: string | null },
): number {
  const { storyId, blockId, page } = params;
  if (storyId && blockId) {
    const idx = pages.findIndex(
      (p) => p.kind === 'spread' && p.storyId === storyId && p.blockId === blockId,
    );
    if (idx >= 0) return idx;
  }
  if (storyId) {
    const idx = pages.findIndex((p) => p.kind === 'spread' && p.storyId === storyId);
    if (idx >= 0) return idx;
  }
  if (page) {
    const idx = parseInt(page, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < pages.length) return idx;
  }
  return 0;
}
