import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import { composeImageStoryReaderText, normalizePromptEntry } from '@/lib/imagePrompts';
import { blockClipIds, imageBlockAsStimulus, resolveStoryBlocks } from '@/lib/storyBlocks';import type { AudioClip, Book, Chapter, StoryContentBlock, StorySession } from '@/types';

export type AlbumPageKind = 'cover' | 'toc' | 'chapter' | 'spread';

export interface AlbumSpread {
  kind: AlbumPageKind;
  chapterTitle?: string;
  storyTitle?: string;
  storyId?: string;
  blockId?: string;
  blockType?: 'image' | 'text';
  imageUrl?: string;
  imageTitle?: string;
  dateLabel?: string;
  bodyText?: string;
  clipIds: string[];
  contributorName?: string;
  contributorRelationship?: string;
  statusLabel?: string;
}

const PUBLIC_STATUSES = new Set(['ready', 'pending_approval', 'approved']);

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
    return [
      {
        kind: 'spread',
        ...base,
        blockType: hasImage ? 'image' : 'text',
        imageUrl: story.imageStimulus?.imageUrl,
        imageTitle: story.imageStimulus?.title ?? story.title,
        dateLabel: story.imageStimulus?.date ?? (story.imageStimulus?.year ? String(story.imageStimulus.year) : story.textStimulus?.date ?? (story.textStimulus?.year ? String(story.textStimulus.year) : undefined)),
        bodyText: body || story.textStimulus?.content || '',
        clipIds: story.clipOrder.length ? story.clipOrder : clips.map((c) => c.id),
      },
    ];
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
      imageTitle: block.type === 'image' ? block.title : undefined,
      dateLabel: dateLabel(block),
      bodyText: blockBodyText(block, story, clips) || (block.type === 'text' ? block.content : ''),
      clipIds: blockClipIds(block),
    }));
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
    pages.push({ kind: 'chapter', chapterTitle: 'More Stories / और कहानियाँ', clipIds: [] });
    for (const story of extra) {
      const clips = (clipsByStory[story.id] ?? []).sort((a, b) => a.order - b.order);
      pages.push(...spreadsForStory(story, clips, undefined, preview));
    }
  }

  return pages;
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
