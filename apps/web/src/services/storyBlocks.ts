import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  query,
  collection,
  where,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { uploadFileAndGetUrl } from '@/lib/storageUpload';
import { stripUndefined } from '@/lib/firestoreUtils';
import {
  composeBlocksReaderText,
  createImageBlock,
  createTextBlock,
  findPromptKeyForClip,
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

async function nextClipNumberForBlock(sessionId: string, blockId: string): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, 'clips'),
      where('storySessionId', '==', sessionId),
      where('blockId', '==', blockId),
    ),
  );
  let max = 0;
  let legacyCount = 0;
  snap.forEach((d) => {
    const data = d.data();
    if (data.errorMessage === 'removed') return;
    legacyCount++;
    const n = data.clipNumber as number | undefined;
    if (typeof n === 'number') max = Math.max(max, n);
  });
  return max > 0 ? max + 1 : legacyCount + 1;
}

async function nextClipNumberForSession(sessionId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'clips'), where('storySessionId', '==', sessionId)),
  );
  let max = 0;
  let legacyCount = 0;
  snap.forEach((d) => {
    const data = d.data();
    if (data.errorMessage === 'removed' || data.blockId) return;
    legacyCount++;
    const n = data.clipNumber as number | undefined;
    if (typeof n === 'number') max = Math.max(max, n);
  });
  return max > 0 ? max + 1 : legacyCount + 1;
}

async function nextClipNumberForPrompt(
  sessionId: string,
  blockId: string,
  promptKey: string,
): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, 'clips'),
      where('storySessionId', '==', sessionId),
      where('blockId', '==', blockId),
    ),
  );
  let max = 0;
  let legacyCount = 0;
  snap.forEach((d) => {
    const data = d.data();
    if (data.errorMessage === 'removed') return;
    if (data.promptKey !== promptKey) return;
    legacyCount++;
    const n = data.clipNumber as number | undefined;
    if (typeof n === 'number') max = Math.max(max, n);
  });
  return max > 0 ? max + 1 : legacyCount + 1;
}

async function nextClipNumberForLegacyPrompt(sessionId: string, promptKey: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'clips'), where('storySessionId', '==', sessionId)),
  );
  let max = 0;
  let legacyCount = 0;
  snap.forEach((d) => {
    const data = d.data();
    if (data.errorMessage === 'removed' || data.blockId) return;
    if (data.promptKey !== promptKey) return;
    legacyCount++;
    const n = data.clipNumber as number | undefined;
    if (typeof n === 'number') max = Math.max(max, n);
  });
  return max > 0 ? max + 1 : legacyCount + 1;
}

export async function nextClipNumber(
  sessionId: string,
  blockId?: string,
  promptKey?: string,
): Promise<number> {
  if (blockId && promptKey) return nextClipNumberForPrompt(sessionId, blockId, promptKey);
  if (blockId) return nextClipNumberForBlock(sessionId, blockId);
  if (promptKey) return nextClipNumberForLegacyPrompt(sessionId, promptKey);
  return nextClipNumberForSession(sessionId);
}

export async function updateClipLabel(clipId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  await updateDoc(doc(db, 'clips', clipId), stripUndefined({ label: trimmed || null }));
}

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
  const imageUrl = await uploadFileAndGetUrl(storageRef, data.file);
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

export async function addImageBlockFromStorage(
  sessionId: string,
  data: {
    title?: string;
    imageUrl: string;
    imageStoragePath: string;
    date?: string;
    year?: number;
  },
): Promise<string> {
  await ensureContentBlocksPersisted(sessionId);
  const { order, blocks } = await loadBlocks(sessionId);
  const block = createImageBlock({
    title: data.title?.trim() ?? '',
    imageUrl: data.imageUrl,
    imageStoragePath: data.imageStoragePath,
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
  const clipNumber = await nextClipNumberForBlock(sessionId, blockId);
  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      blockId,
      clipNumber,
      order: orderIdx,
      storagePath: '',
      durationSeconds,
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
  const clipNumber = await nextClipNumberForBlock(sessionId, blockId);

  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      blockId,
      promptKey,
      clipNumber,
      order: orderIdx,
      storagePath: '',
      durationSeconds,
      status: 'uploading',
      createdAt: serverTimestamp(),
    }),
  );

  const clipId = clipRef.id;
  const updatedPrompts = mergePromptAnswers(prompts, promptKey as keyof ImagePromptAnswers, {
    clipOrder: [...clipOrder, clipId],
    skipped: false,
  });
  const unifiedOrder = block.clipOrder?.length ? [...block.clipOrder, clipId] : undefined;
  blocks[blockId] = {
    ...block,
    prompts: updatedPrompts,
    ...(unifiedOrder ? { clipOrder: unifiedOrder } : {}),
  };
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
  const clipSnap = await getDoc(doc(db, 'clips', clipId));
  const clipPromptKey = clipSnap.data()?.promptKey as keyof ImagePromptAnswers | undefined;

  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block) return;

  if (block.type === 'text') {
    blocks[blockId] = { ...block, clipOrder: block.clipOrder.filter((id) => id !== clipId) };
  } else {
    const prompts = { ...(block.prompts ?? {}) };
    const keysToUpdate = new Set<keyof ImagePromptAnswers>();

    for (const key of Object.keys(prompts) as (keyof ImagePromptAnswers)[]) {
      if (prompts[key]?.clipOrder?.includes(clipId)) keysToUpdate.add(key);
    }

    const fromBlock = findPromptKeyForClip(block, clipId);
    if (fromBlock) keysToUpdate.add(fromBlock);
    if (clipPromptKey) keysToUpdate.add(clipPromptKey);

    for (const key of keysToUpdate) {
      const entry = prompts[key];
      const nextOrder = (entry?.clipOrder ?? []).filter((id) => id !== clipId);
      prompts[key] = mergePromptAnswers(prompts, key, { clipOrder: nextOrder });
    }

    blocks[blockId] = {
      ...block,
      prompts,
      clipOrder: block.clipOrder?.filter((id) => id !== clipId),
    };
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'storySessions', sessionId), {
    contentBlockOrder: order,
    contentBlocks: blocks,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'clips', clipId), { status: 'error', errorMessage: 'removed' });
  await batch.commit();
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

export async function reorderImageBlockClips(sessionId: string, blockId: string, clipOrder: string[]) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'image') return;

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

export async function reorderBlockPromptClips(
  sessionId: string,
  blockId: string,
  promptKey: keyof ImagePromptAnswers,
  clipOrder: string[],
) {
  const { order, blocks } = await loadBlocks(sessionId);
  const block = blocks[blockId];
  if (!block || block.type !== 'image') return;

  const batch = writeBatch(db);
  clipOrder.forEach((clipId, index) => {
    batch.update(doc(db, 'clips', clipId), { order: index });
  });

  const prompts = mergePromptAnswers(block.prompts ?? {}, promptKey, { clipOrder });
  blocks[blockId] = { ...block, prompts };
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
