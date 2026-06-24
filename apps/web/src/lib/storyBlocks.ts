import { composeImageStoryReaderText, hasAnyPromptContent, mergeImagePromptAnswers, normalizePromptEntry } from '@/lib/imagePrompts';
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

    for (const blockId of order) {
      const block = blocks[blockId];
      if (!block) continue;

      if (block.type === 'text' && block.clipOrder.length === 0 && session.clipOrder.length > 0) {
        blocks[blockId] = { ...block, clipOrder: [...session.clipOrder] };
      }

      if (block.type === 'image' && session.imageStimulus?.prompts) {
        blocks[blockId] = {
          ...block,
          prompts: mergeImagePromptAnswers(block.prompts ?? {}, session.imageStimulus.prompts),
        };
      }
    }

    return { order, blocks, migrated: false };
  }

  const blocks: Record<string, StoryContentBlock> = {};
  const order: string[] = [];

  if (session.textStimulus) {
    const id = newBlockId();
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
    const id = newBlockId();
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
    const id = newBlockId();
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

export function blockLabel(block: StoryContentBlock): string {
  if (block.type === 'text') {
    const preview = block.content.slice(0, 48);
    return preview + (block.content.length > 48 ? '…' : '');
  }
  return block.title?.trim() || 'Photo / फोटो';
}

export function blockClipIds(block: StoryContentBlock): string[] {
  if (block.type === 'text') return block.clipOrder;
  const ids: string[] = [];
  for (const key of Object.keys(block.prompts) as (keyof typeof block.prompts)[]) {
    const entry = normalizePromptEntry(block.prompts[key]);
    ids.push(...(entry.clipOrder ?? []));
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

export function clipsForBlock(clips: AudioClip[], block: StoryContentBlock): AudioClip[] {
  const ids = blockClipIds(block);
  const byId = ids
    .map((id) => clips.find((c) => c.id === id && c.errorMessage !== 'removed'))
    .filter(Boolean) as AudioClip[];

  const byBlock = clips.filter(
    (c) => c.errorMessage !== 'removed' && c.blockId === block.id,
  );

  const merged: AudioClip[] = [];
  const seen = new Set<string>();
  for (const c of [...byId, ...byBlock]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      merged.push(c);
    }
  }

  if (merged.length > 0) return merged.sort((a, b) => a.order - b.order);

  if (block.type === 'text') {
    return clips
      .filter((c) => !c.blockId && !c.promptKey && c.errorMessage !== 'removed')
      .sort((a, b) => a.order - b.order);
  }

  return [];
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
      (c.blockId === block.id || !c.blockId),
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

export function textBlockClipOrder(block: StoryTextBlock, clips: AudioClip[]): string[] {
  const resolved = clipsForBlock(clips, block);
  if (resolved.length > 0) return resolved.map((c) => c.id);
  return block.clipOrder;
}
