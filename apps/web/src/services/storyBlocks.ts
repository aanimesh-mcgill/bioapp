import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, writeBatch } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { stripUndefined } from '@/lib/firestoreUtils';
import {
  composeBlocksReaderText,
  createImageBlock,
  createTextBlock,
  imageBlockAsStimulus,
  resolveStoryBlocks,
} from '@/lib/storyBlocks';
import { mergePromptAnswers, composeImageStoryReaderText } from '@/lib/imagePrompts';
import type {
  ImagePromptAnswers,
  ImagePromptEntry,
  StoryContentBlock,
  StoryImageBlock,
  StorySession,
  StoryTextBlock,
  TextStimulusData,
} from '@/types';

async function loadBlocks(sessionId: string) {
  const snap = await getDoc(doc(db, 'storySessions', sessionId));
  if (!snap.exists()) throw new Error('Story not found');
  const session = { id: snap.id, ...snap.data() } as StorySession;
  const resolved = resolveStoryBlocks(session);
  return { session, ...resolved };
}

async function saveBlocks(
  sessionId: string,
  order: string[],
  blocks: Record<string, StoryContentBlock>,
  extra: Record<string, unknown> = {},
) {
  const readerText = composeBlocksReaderText(blocks, order);
  const firstText = order.map((id) => blocks[id]).find((b) => b?.type === 'text') as
    | { content: string; date?: string; year?: number }
    | undefined;
  const firstImage = order.map((id) => blocks[id]).find((b) => b?.type === 'image') as StoryImageBlock | undefined;

  await updateDoc(
    doc(db, 'storySessions', sessionId),
    stripUndefined({
      contentBlockOrder: order,
      contentBlocks: blocks,
      sourceType: order.length > 1 ? 'composite' : firstImage ? 'image_stimulus' : firstText ? 'text_stimulus' : 'freeform',
      textStimulus: firstText
        ? { content: firstText.content, date: firstText.date, year: firstText.year }
        : null,
      imageStimulus: firstImage ? imageBlockAsStimulus(firstImage) : null,
      editedDraft: readerText || null,
      updatedAt: serverTimestamp(),
      ...extra,
    }),
  );
}

export async function ensureContentBlocksPersisted(sessionId: string): Promise<void> {
  const { session, order, blocks, migrated } = await loadBlocks(sessionId);
  if (!migrated || order.length === 0) return;
  if (session.contentBlockOrder?.length) return;
  await saveBlocks(sessionId, order, blocks);
}

export async function addTextBlock(sessionId: string, data: TextStimulusData): Promise<string> {
  await ensureContentBlocksPersisted(sessionId);
  const { order, blocks } = await loadBlocks(sessionId);
  const block = createTextBlock(data);
  blocks[block.id] = block;
  order.push(block.id);
  await saveBlocks(sessionId, order, blocks);
  return block.id;
}

export async function addImageBlock(
  userId: string,
  sessionId: string,
  data: { title?: string; file: File; date?: string; year?: number },
): Promise<string> {
  await ensureContentBlocksPersisted(sessionId);
  const { order, blocks } = await loadBlocks(sessionId);
  const imageStoragePath = `stories/${userId}/${sessionId}/images/${Date.now()}_${data.file.name}`;
  const storageRef = ref(storage, imageStoragePath);
  await uploadBytesResumable(storageRef, data.file, { contentType: data.file.type });
  const imageUrl = await getDownloadURL(storageRef);
  const block = createImageBlock({
    title: data.title?.trim() ?? '',
    imageUrl,
    imageStoragePath,
    date: data.date,
    year: data.year,
  });
  blocks[block.id] = block;
  order.push(block.id);
  await saveBlocks(sessionId, order, blocks);
  return block.id;
}

export async function updateTextBlock(
  sessionId: string,
  blockId: string,
  partial: Partial<Pick<StoryTextBlock, 'content' | 'date' | 'year'>>,
) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'text') return;
  blocks[blockId] = { ...block, ...partial };
  await saveBlocks(sessionId, order, blocks);
}

export async function updateImageBlockMeta(
  sessionId: string,
  blockId: string,
  partial: Partial<Pick<StoryImageBlock, 'title' | 'date' | 'year'>>,
) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'image') return;
  blocks[blockId] = { ...block, ...partial };
  await saveBlocks(sessionId, order, blocks);
}

export async function deleteContentBlock(sessionId: string, blockId: string) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block) return;
  delete blocks[blockId];
  const newOrder = order.filter((id) => id !== blockId);
  await saveBlocks(sessionId, newOrder, blocks);
}

export async function reorderContentBlocks(sessionId: string, newOrder: string[]) {
  const { blocks } = await loadBlocks(sessionId);
  await saveBlocks(sessionId, newOrder, blocks);
}

export async function uploadBlockClip(
  userId: string,
  sessionId: string,
  blockId: string,
  blob: Blob,
  durationSeconds: number,
): Promise<string> {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'text') throw new Error('Invalid text block');

  const orderIdx = block.clipOrder.length;
  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      blockId,
      order: orderIdx,
      storagePath: '',
      durationSeconds,
      label: block.content.slice(0, 40),
      status: 'uploading',
      createdAt: serverTimestamp(),
    }),
  );

  const clipId = clipRef.id;
  blocks[blockId] = { ...block, clipOrder: [...block.clipOrder, clipId] };
  await saveBlocks(sessionId, order, blocks, { status: 'recording' });

  const storagePath = `stories/${userId}/${sessionId}/clips/${clipId}/audio.webm`;
  const storageRefObj = ref(storage, storagePath);
  const contentType =
    blob.type.startsWith('audio/') || blob.type === 'video/webm' ? blob.type : 'audio/webm';

  uploadBytesResumable(storageRefObj, blob, { contentType }).on(
    'state_changed',
    undefined,
    async (err) => {
      await updateDoc(doc(db, 'clips', clipId), { status: 'error', errorMessage: err.message });
    },
    async () => {
      const audioUrl = await getDownloadURL(storageRefObj);
      await updateDoc(doc(db, 'clips', clipId), {
        storagePath,
        audioUrl,
        status: 'transcribing',
      });
      await updateDoc(doc(db, 'storySessions', sessionId), {
        status: 'transcribing',
        updatedAt: serverTimestamp(),
      });
    },
  );

  return clipId;
}

export async function uploadBlockPromptClip(
  userId: string,
  sessionId: string,
  blockId: string,
  promptKey: string,
  blob: Blob,
  durationSeconds: number,
): Promise<string> {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'image') throw new Error('Invalid image block');

  const prompts = block.prompts ?? {};
  const entry = prompts[promptKey as keyof ImagePromptAnswers];
  const clipOrder = entry?.clipOrder ?? [];
  const orderIdx = clipOrder.length;

  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      blockId,
      promptKey,
      order: orderIdx,
      storagePath: '',
      durationSeconds,
      label: block.title?.trim() || undefined,
      status: 'uploading',
      createdAt: serverTimestamp(),
    }),
  );

  const clipId = clipRef.id;
  const updatedPrompts = mergePromptAnswers(prompts, promptKey as keyof ImagePromptAnswers, {
    clipOrder: [...clipOrder, clipId],
    skipped: false,
  });
  blocks[blockId] = { ...block, prompts: updatedPrompts };
  await saveBlocks(sessionId, order, blocks);

  const storagePath = `stories/${userId}/${sessionId}/clips/${clipId}/audio.webm`;
  const storageRefObj = ref(storage, storagePath);
  const contentType =
    blob.type.startsWith('audio/') || blob.type === 'video/webm' ? blob.type : 'audio/webm';

  uploadBytesResumable(storageRefObj, blob, { contentType }).on(
    'state_changed',
    undefined,
    async (err) => {
      await updateDoc(doc(db, 'clips', clipId), { status: 'error', errorMessage: err.message });
    },
    async () => {
      const audioUrl = await getDownloadURL(storageRefObj);
      await updateDoc(doc(db, 'clips', clipId), {
        storagePath,
        audioUrl,
        status: 'transcribing',
      });
    },
  );

  return clipId;
}

export async function updateBlockPromptEntry(
  sessionId: string,
  blockId: string,
  promptKey: keyof ImagePromptAnswers,
  partial: Partial<ImagePromptEntry>,
) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'image') return;
  const prompts = mergePromptAnswers(block.prompts ?? {}, promptKey, partial);
  blocks[blockId] = { ...block, prompts };
  await saveBlocks(sessionId, order, blocks);
}

export async function deleteBlockClip(sessionId: string, blockId: string, clipId: string) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block) return;

  if (block.type === 'text') {
    blocks[blockId] = { ...block, clipOrder: block.clipOrder.filter((id) => id !== clipId) };
  } else {
    const prompts = { ...block.prompts };
    for (const key of Object.keys(prompts) as (keyof ImagePromptAnswers)[]) {
      const entry = prompts[key];
      if (entry?.clipOrder?.includes(clipId)) {
        prompts[key] = mergePromptAnswers(prompts, key, {
          clipOrder: entry.clipOrder.filter((id) => id !== clipId),
        });
      }
    }
    blocks[blockId] = { ...block, prompts };
  }

  await saveBlocks(sessionId, order, blocks);
  await updateDoc(doc(db, 'clips', clipId), { status: 'error', errorMessage: 'removed' });
}

export async function reorderBlockClips(sessionId: string, blockId: string, clipOrder: string[]) {
  const { blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'text') return;

  const batch = writeBatch(db);
  clipOrder.forEach((clipId, index) => {
    batch.update(doc(db, 'clips', clipId), { order: index });
  });
  blocks[blockId] = { ...block, clipOrder };
  batch.update(doc(db, 'storySessions', sessionId), {
    contentBlocks: blocks,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function createSessionWithTextBlock(
  sessionId: string,
  data: TextStimulusData,
): Promise<{ blockId: string; order: string[]; blocks: Record<string, StoryContentBlock> }> {
  const block = createTextBlock(data);
  const order = [block.id];
  const blocks = { [block.id]: block };
  await saveBlocks(sessionId, order, blocks);
  return { blockId: block.id, order, blocks };
}

export async function createSessionWithImageBlock(
  sessionId: string,
  block: StoryImageBlock,
): Promise<void> {
  const order = [block.id];
  const blocks = { [block.id]: block };
  await saveBlocks(sessionId, order, blocks);
}

/** Sync composed reader text from all blocks */
export function composeImageBlockReaderText(block: StoryImageBlock): string {
  return composeImageStoryReaderText(imageBlockAsStimulus(block));
}
