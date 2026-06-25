import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import { normalizePromptEntry, mergeImagePromptAnswers, composeImageStoryReaderText, hasAnyPromptContent } from '@/lib/imagePrompts';
import type {
  AudioClip,
  ImagePromptAnswers,
  ImageStimulusData,
  StoryContentBlock,
  StoryImageBlock,
  StorySession,
  StoryTextBlock,
  TextStimulusData,
} from '@/types';

export function newBlockId(): string {
  return crypto.randomUUID();
}

function legacyTextBlockId(sessionId: string): string {
  return `legacy-text-${sessionId}`;
}

function legacyImageBlockId(sessionId: string): string {
  return `legacy-image-${sessionId}`;
}

function legacyClipBlockId(sessionId: string): string {
  return `legacy-clips-${sessionId}`;
}

/** Legacy imageStimulus prompts apply only to the matching image block, not every photo. */
function shouldMergeLegacyImagePrompts(block: StoryImageBlock, session: StorySession): boolean {
  const stim = session.imageStimulus;
  if (!stim?.prompts || Object.keys(stim.prompts).length === 0) return false;

  const matchesStimulus =
    (stim.imageUrl && block.imageUrl === stim.imageUrl) ||
    (stim.imageStoragePath && block.imageStoragePath === stim.imageStoragePath);
  if (!matchesStimulus) return false;

  const hasOwnContent = Object.values(block.prompts ?? {}).some((entry) => {
    const n = normalizePromptEntry(entry);
    return (
      (n.clipOrder?.length ?? 0) > 0 ||
      Boolean(n.draftText?.trim()) ||
      Boolean(n.finalText?.trim()) ||
      n.skipped
    );
  });
  return !hasOwnContent;
}

export function createTextBlock(data: TextStimulusData): StoryTextBlock {
  return {
    id: newBlockId(),
    type: 'text',
    content: data.content,
    date: data.date,
    year: data.year,
    clipOrder: [],
  };
}

export function createImageBlock(data: Omit<StoryImageBlock, 'id' | 'type' | 'prompts'>): StoryImageBlock {
  return {
    id: newBlockId(),
    type: 'image',
    ...data,
    prompts: {},
  };
}

/** Resolve ordered blocks — migrates legacy single text/image fields in memory. */
export function resolveStoryBlocks(session: StorySession): {
  order: string[];
  blocks: Record<string, StoryContentBlock>;
  migrated: boolean;
} {
  if (session.contentBlockOrder?.length && session.contentBlocks) {
    const order = session.contentBlockOrder;
    const blocks = { ...session.contentBlocks };
    let legacySessionClipsAssigned = false;

    for (const blockId of order) {
      const block = blocks[blockId];
      if (!block) continue;

      if (
        block.type === 'text' &&
        block.clipOrder.length === 0 &&
        session.clipOrder.length > 0 &&
        !legacySessionClipsAssigned
      ) {
        blocks[blockId] = { ...block, clipOrder: [...session.clipOrder] };
        legacySessionClipsAssigned = true;
      }

      if (block.type === 'image' && shouldMergeLegacyImagePrompts(block, session)) {
        blocks[blockId] = {
          ...block,
          prompts: mergeImagePromptAnswers(block.prompts ?? {}, session.imageStimulus!.prompts ?? {}),
        };
      }
    }

    return { order, blocks, migrated: false };
  }

  const blocks: Record<string, StoryContentBlock> = {};
  const order: string[] = [];

  if (session.textStimulus) {
    const id = legacyTextBlockId(session.id);
    blocks[id] = {
      id,
      type: 'text',
      content: session.textStimulus.content,
      date: session.textStimulus.date,
      year: session.textStimulus.year,
      clipOrder: [...session.clipOrder],
    };
    order.push(id);
  }

  if (session.imageStimulus) {
    const id = legacyImageBlockId(session.id);
    blocks[id] = {
      id,
      type: 'image',
      title: session.imageStimulus.title,
      imageUrl: session.imageStimulus.imageUrl,
      imageStoragePath: session.imageStimulus.imageStoragePath,
      date: session.imageStimulus.date,
      year: session.imageStimulus.year,
      prompts: session.imageStimulus.prompts ?? {},
    };
    order.push(id);
  }

  if (order.length === 0 && session.clipOrder.length > 0) {
    const id = legacyClipBlockId(session.id);
    blocks[id] = {
      id,
      type: 'text',
      content: session.stimulusPrompt ?? session.title,
      clipOrder: [...session.clipOrder],
    };
    order.push(id);
  }

  return { order, blocks, migrated: order.length > 0 };
}

export function blockLabel(block: StoryContentBlock, photoFallback = 'Photo'): string {
  if (block.type === 'text') {
    const preview = block.content.slice(0, 48);
    return preview + (block.content.length > 48 ? '…' : '');
  }
  return block.title?.trim() || photoFallback;
}

export function findPromptKeyForClip(
  block: StoryImageBlock,
  clipId: string,
): keyof ImagePromptAnswers | null {
  for (const { key } of IMAGE_PROMPT_QUESTIONS) {
    const entry = normalizePromptEntry(block.prompts[key]);
    if (entry.clipOrder?.includes(clipId)) return key;
  }
  return null;
}

export function imageBlockClipOrder(block: StoryImageBlock, clips: AudioClip[]): string[] {
  const defaultIds = defaultImageBlockClipIds(block, clips);
  if (!block.clipOrder?.length) return defaultIds;

  const valid = new Set(defaultIds);
  const fromSaved = block.clipOrder.filter((id) => valid.has(id));
  const missing = defaultIds.filter((id) => !fromSaved.includes(id));
  return [...fromSaved, ...missing];
}

function defaultImageBlockClipIds(block: StoryImageBlock, clips: AudioClip[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const { key } of IMAGE_PROMPT_QUESTIONS) {
    const entry = normalizePromptEntry(block.prompts[key]);
    for (const id of entry.clipOrder ?? []) {
      if (seen.has(id)) continue;
      const clip = clips.find((c) => c.id === id);
      if (clip && clip.errorMessage !== 'removed') {
        ids.push(id);
        seen.add(id);
      }
    }
  }

  const orphans = clips
    .filter((c) => c.blockId === block.id && !seen.has(c.id) && c.errorMessage !== 'removed')
    .sort((a, b) => a.order - b.order);
  for (const c of orphans) {
    ids.push(c.id);
  }

  return ids;
}

export function blockClipIds(block: StoryContentBlock): string[] {
  if (block.type === 'text') return block.clipOrder;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const key of Object.keys(block.prompts) as (keyof typeof block.prompts)[]) {
    const entry = normalizePromptEntry(block.prompts[key]);
    for (const id of entry.clipOrder ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export function storyHasRecordableContent(
  session: StorySession,
  blocks: Record<string, StoryContentBlock>,
  order: string[],
): boolean {
  if (session.clipOrder.length > 0) return true;
  for (const id of order) {
    const block = blocks[id];
    if (!block) continue;
    if (block.type === 'text' && block.clipOrder.length > 0) return true;
    if (block.type === 'image' && hasAnyPromptContent(block.prompts)) return true;
  }
  return false;
}

export function composeBlocksReaderText(blocks: Record<string, StoryContentBlock>, order: string[]): string {
  const parts: string[] = [];
  for (const id of order) {
    const block = blocks[id];
    if (!block) continue;
    if (block.type === 'text') {
      if (block.content.trim()) parts.push(block.content.trim());
    } else {
      const text = composeImageStoryReaderText({
        title: block.title,
        imageUrl: block.imageUrl,
        imageStoragePath: block.imageStoragePath,
        date: block.date,
        year: block.year,
        prompts: block.prompts,
      });
      if (text) parts.push(text);
    }
  }
  return parts.join('\n\n');
}

export function imageBlockAsStimulus(block: StoryImageBlock): ImageStimulusData {
  return {
    title: block.title,
    imageUrl: block.imageUrl,
    imageStoragePath: block.imageStoragePath,
    date: block.date,
    year: block.year,
    prompts: block.prompts,
  };
}

export function blockTimelineMs(block: StoryContentBlock, fallbackMs: number): number {
  if (block.date) {
    const t = Date.parse(block.date);
    if (!Number.isNaN(t)) return t;
  }
  if (block.year) return Date.UTC(block.year, 0, 1);
  return fallbackMs;
}

export function clipsForBlock(
  clips: AudioClip[],
  block: StoryContentBlock,
  allBlocks?: Record<string, StoryContentBlock>,
): AudioClip[] {
  if (block.type === 'image') {
    return imageBlockClipOrder(block, clips)
      .map((id) => clips.find((c) => c.id === id && c.errorMessage !== 'removed'))
      .filter(Boolean) as AudioClip[];
  }

  const ids = blockClipIds(block);
  const byId = ids
    .map((id) => clips.find((c) => c.id === id && c.errorMessage !== 'removed'))
    .filter(Boolean) as AudioClip[];

  const byBlock = clips.filter(
    (c) => c.errorMessage !== 'removed' && c.blockId === block.id,
  );

  const merged: AudioClip[] = [];
  const seen = new Set<string>();
  const add = (c: AudioClip | undefined) => {
    if (!c || c.errorMessage === 'removed' || seen.has(c.id)) return;
    seen.add(c.id);
    merged.push(c);
  };

  for (const c of byId) add(c);
  for (const c of byBlock) add(c);

  if (block.type === 'text') {
    const textBlocks = allBlocks
      ? Object.values(allBlocks).filter((b) => b.type === 'text')
      : [];
    const soleTextBlock = textBlocks.length === 1 && textBlocks[0].id === block.id;

    if (soleTextBlock || merged.length === 0) {
      for (const c of clips) {
        if (!c.blockId && !c.promptKey) add(c);
      }
    }

    if (soleTextBlock && allBlocks) {
      const knownIds = new Set(Object.keys(allBlocks));
      for (const c of clips) {
        if (c.blockId && !knownIds.has(c.blockId) && !c.promptKey) add(c);
      }
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}

export function clipsForPrompt(
  clips: AudioClip[],
  block: StoryImageBlock,
  promptKey: keyof ImagePromptAnswers,
): AudioClip[] {
  const entry = normalizePromptEntry(block.prompts[promptKey]);
  const fromOrder = (entry.clipOrder ?? [])
    .map((id) => clips.find((c) => c.id === id && c.errorMessage !== 'removed'))
    .filter(Boolean) as AudioClip[];

  const byKey = clips.filter(
    (c) =>
      c.errorMessage !== 'removed' &&
      c.promptKey === promptKey &&
      c.blockId === block.id,
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

export function textBlockClipOrder(
  block: StoryTextBlock,
  clips: AudioClip[],
  allBlocks?: Record<string, StoryContentBlock>,
): string[] {
  const resolved = clipsForBlock(clips, block, allBlocks);
  if (resolved.length > 0) return resolved.map((c) => c.id);
  return block.clipOrder;
}

/** All clip IDs for a story — session-level plus every content block. */
export function storyClipIds(session: StorySession): string[] {
  const { order, blocks } = resolveStoryBlocks(session);
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const blockId of order) {
    const block = blocks[blockId];
    if (block) {
      for (const id of blockClipIds(block)) push(id);
    }
  }
  for (const id of session.clipOrder) push(id);
  return ids;
}

export function storyClipCount(session: StorySession): number {
  return storyClipIds(session).length;
}
