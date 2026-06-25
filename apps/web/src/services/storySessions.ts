import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  getDocs,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '@/lib/firebase';
import { uploadFileAndGetUrl } from '@/lib/storageUpload';
import { markPromptComplete } from '@/services/bookPrompts';
import { nextClipNumber } from '@/services/storyBlocks';
import type {
  StorySession,
  AudioClip,
  TranscriptLanguage,
  HindiOutputMode,
  StorySourceType,
  TextStimulusData,
  ImageStimulusData,
  ImagePromptAnswers,
  ImagePromptEntry,
  StoryPerspective,
  Chapter,
} from '@/types';
import { mergePromptAnswers, composeImageStoryReaderText } from '@/lib/imagePrompts';
import { resolveStoryBlocks } from '@/lib/storyBlocks';
import { stripUndefined, toDate } from '@/lib/firestoreUtils';
import { updateImageBlockMeta } from '@/services/storyBlocks';

function mapSession(id: string, data: Record<string, unknown>): StorySession {
  return {
    id,
    userId: data.userId as string,
    bookId: data.bookId as string | undefined,
    collabBookId: data.collabBookId as string | undefined,
    bookOwnerId: data.bookOwnerId as string | undefined,
    chapterId: data.chapterId as string | undefined,
    chapterOrder: data.chapterOrder as number | undefined,
    publicSlug: data.publicSlug as string | undefined,
    title: data.title as string,
    sourceType: data.sourceType as StorySourceType,
    stimulusId: data.stimulusId as string | undefined,
    stimulusPrompt: data.stimulusPrompt as string | undefined,
    textStimulus: data.textStimulus as TextStimulusData | undefined,
    imageStimulus: data.imageStimulus as ImageStimulusData | undefined,
    contentBlockOrder: data.contentBlockOrder as string[] | undefined,
    contentBlocks: data.contentBlocks as StorySession['contentBlocks'],
    clipOrder: (data.clipOrder as string[]) ?? [],
    languageHint: (data.languageHint as TranscriptLanguage) ?? 'mixed',
    hindiOutputMode: (data.hindiOutputMode as HindiOutputMode) ?? 'hindi_script',
    status: data.status as StorySession['status'],
    combinedTranscript: data.combinedTranscript as StorySession['combinedTranscript'],
    editedTranscript: data.editedTranscript as string | undefined,
    draft: data.draft as string | undefined,
    editedDraft: data.editedDraft as string | undefined,
    attachments: data.attachments as StorySession['attachments'],
    perspective: (data.perspective as StoryPerspective) ?? 'first',
    outputLanguage: (data.outputLanguage as 'en' | 'hi') ?? 'en',
    buyerNotes: data.buyerNotes as string | undefined,
    errorMessage: data.errorMessage as string | undefined,
    isContributorStory: data.isContributorStory as boolean | undefined,
    contributorInviteId: data.contributorInviteId as string | undefined,
    contributorName: data.contributorName as string | undefined,
    contributorRelationship: data.contributorRelationship as string | undefined,
    contributorSubmitted: data.contributorSubmitted as boolean | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function mapStorySession(id: string, data: Record<string, unknown>): StorySession {
  return mapSession(id, data);
}

function mapClip(id: string, data: Record<string, unknown>): AudioClip {
  return {
    id,
    storySessionId: data.storySessionId as string,
    userId: data.userId as string,
    order: data.order as number,
    promptKey: data.promptKey as string | undefined,
    blockId: data.blockId as string | undefined,
    label: data.label as string | undefined,
    clipNumber: data.clipNumber as number | undefined,
    storagePath: data.storagePath as string,
    audioUrl: data.audioUrl as string | undefined,
    durationSeconds: data.durationSeconds as number | undefined,
    status: data.status as AudioClip['status'],
    transcript: data.transcript as AudioClip['transcript'],
    errorMessage: data.errorMessage as string | undefined,
    createdAt: toDate(data.createdAt),
  };
}

export function mapAudioClip(id: string, data: Record<string, unknown>): AudioClip {
  return mapClip(id, data);
}

export interface CreateSessionOpts {
  userId: string;
  title: string;
  sourceType: StorySourceType;
  stimulusId?: string;
  stimulusPrompt?: string;
  textStimulus?: TextStimulusData;
  imageStimulus?: ImageStimulusData;
  languageHint: TranscriptLanguage;
  hindiOutputMode: HindiOutputMode;
  perspective: StoryPerspective;
  bookId?: string;
  collabBookId?: string;
  bookOwnerId?: string;
  contributorInviteId?: string;
  contributorName?: string;
  contributorRelationship?: string;
  isContributorStory?: boolean;
}

function imageStimulusTitle(data: Record<string, unknown> | undefined): string | undefined {
  const title = (data?.imageStimulus as ImageStimulusData | undefined)?.title?.trim();
  return title || undefined;
}

export async function createStorySession(opts: CreateSessionOpts): Promise<string> {
  const ref = await addDoc(
    collection(db, 'storySessions'),
    stripUndefined({
      userId: opts.userId,
      title: opts.title,
      sourceType: opts.sourceType,
      stimulusId: opts.stimulusId ?? null,
      stimulusPrompt: opts.stimulusPrompt ?? null,
      textStimulus: opts.textStimulus ?? null,
      imageStimulus: opts.imageStimulus ?? null,
      bookId: opts.bookId ?? null,
      collabBookId: opts.collabBookId ?? opts.bookId ?? null,
      bookOwnerId: opts.bookOwnerId ?? null,
      contributorInviteId: opts.contributorInviteId ?? null,
      contributorName: opts.contributorName ?? null,
      contributorRelationship: opts.contributorRelationship ?? null,
      isContributorStory: opts.isContributorStory ?? false,
      clipOrder: [],
      languageHint: opts.languageHint,
      hindiOutputMode: opts.hindiOutputMode,
      perspective: opts.perspective,
      outputLanguage: 'en',
      status: 'recording',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

export async function uploadImageStimulus(
  userId: string,
  sessionId: string,
  file: File,
): Promise<{ imageUrl: string; imageStoragePath: string }> {
  const imageStoragePath = `stories/${userId}/${sessionId}/images/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, imageStoragePath);
  const imageUrl = await uploadFileAndGetUrl(storageRef, file);
  return { imageUrl, imageStoragePath };
}

/** Upload clip in background — returns clipId immediately after Firestore doc is created */
export async function uploadClip(
  userId: string,
  sessionId: string,
  blob: Blob,
  durationSeconds: number,
  order: number,
): Promise<string> {
  const clipNumber = await nextClipNumber(sessionId);

  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      order,
      clipNumber,
      storagePath: '',
      durationSeconds,
      status: 'uploading',
      createdAt: serverTimestamp(),
    }),
  );

  const clipId = clipRef.id;
  const storagePath = `stories/${userId}/${sessionId}/clips/${clipId}/audio.webm`;
  const storageRefObj = ref(storage, storagePath);

  const contentType =
    blob.type.startsWith('audio/') || blob.type === 'video/webm' ? blob.type : 'audio/webm';

  await updateDoc(doc(db, 'storySessions', sessionId), {
    clipOrder: arrayUnion(clipId),
    status: 'recording',
    updatedAt: serverTimestamp(),
  });

  // Background upload — don't await in caller for fire-and-forget
  const uploadTask = uploadBytesResumable(storageRefObj, blob, { contentType });

  uploadTask.on(
    'state_changed',
    undefined,
    async (err) => {
      await updateDoc(doc(db, 'clips', clipId), {
        status: 'error',
        errorMessage: err.message,
      });
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

/** Upload audio clip tied to an image prompt question */
export async function uploadPromptClip(
  userId: string,
  sessionId: string,
  promptKey: string,
  blob: Blob,
  durationSeconds: number,
): Promise<string> {
  const sessionSnap = await getDoc(doc(db, 'storySessions', sessionId));
  const imageStimulus = sessionSnap.data()?.imageStimulus as ImageStimulusData | undefined;
  if (!imageStimulus) {
    throw new Error('Photo not saved yet — upload the image first.');
  }

  const prompts = imageStimulus.prompts ?? {};
  const clipOrder = prompts[promptKey as keyof ImagePromptAnswers]?.clipOrder ?? [];
  const clipNumber = await nextClipNumber(sessionId, undefined, promptKey);

  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      order: clipOrder.length,
      promptKey,
      clipNumber,
      storagePath: '',
      durationSeconds,
      status: 'uploading',
      createdAt: serverTimestamp(),
    }),
  );

  const clipId = clipRef.id;
  const storagePath = `stories/${userId}/${sessionId}/clips/${clipId}/audio.webm`;
  const storageRefObj = ref(storage, storagePath);

  const contentType =
    blob.type.startsWith('audio/') || blob.type === 'video/webm' ? blob.type : 'audio/webm';

  const updatedPrompts = mergePromptAnswers(prompts, promptKey as keyof ImagePromptAnswers, {
    clipOrder: [...clipOrder, clipId],
    skipped: false,
  });

  const sessionData = sessionSnap.data() as Record<string, unknown>;
  const contentBlockOrder = sessionData.contentBlockOrder as string[] | undefined;
  const contentBlocks = sessionData.contentBlocks as Record<string, import('@/types').StoryContentBlock> | undefined;

  const patch: Record<string, unknown> = {
    imageStimulus: stripUndefined({ ...imageStimulus, prompts: updatedPrompts }),
    updatedAt: serverTimestamp(),
  };

  if (contentBlockOrder?.length && contentBlocks) {
    const blocks = { ...contentBlocks };
    for (const blockId of contentBlockOrder) {
      const block = blocks[blockId];
      if (block?.type === 'image') {
        blocks[blockId] = {
          ...block,
          prompts: mergePromptAnswers(block.prompts ?? {}, promptKey as keyof ImagePromptAnswers, {
            clipOrder: [...clipOrder, clipId],
            skipped: false,
          }),
        };
        break;
      }
    }
    patch.contentBlocks = blocks;
  }

  await updateDoc(doc(db, 'storySessions', sessionId), patch);

  const uploadTask = uploadBytesResumable(storageRefObj, blob, { contentType });

  uploadTask.on(
    'state_changed',
    undefined,
    async (err) => {
      await updateDoc(doc(db, 'clips', clipId), {
        status: 'error',
        errorMessage: err.message,
      });
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

export async function updateImagePromptEntry(
  sessionId: string,
  promptKey: keyof ImagePromptAnswers,
  partial: Partial<ImagePromptEntry>,
) {
  const sessionRef = doc(db, 'storySessions', sessionId);
  const snap = await getDoc(sessionRef);
  const imageStimulus = snap.data()?.imageStimulus as ImageStimulusData | undefined;
  if (!imageStimulus) return;

  const prompts = mergePromptAnswers(imageStimulus.prompts ?? {}, promptKey, partial);
  const readerText = composeImageStoryReaderText({ ...imageStimulus, prompts });

  await updateDoc(sessionRef, {
    imageStimulus: stripUndefined({ ...imageStimulus, prompts }),
    editedDraft: readerText || null,
    updatedAt: serverTimestamp(),
  });
}

export async function saveAllImagePrompts(sessionId: string, prompts: ImagePromptAnswers) {
  const sessionRef = doc(db, 'storySessions', sessionId);
  const snap = await getDoc(sessionRef);
  const imageStimulus = snap.data()?.imageStimulus as ImageStimulusData | undefined;
  if (!imageStimulus) return;

  const readerText = composeImageStoryReaderText({ ...imageStimulus, prompts });

  await updateDoc(sessionRef, {
    imageStimulus: stripUndefined({ ...imageStimulus, prompts }),
    editedDraft: readerText || null,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePromptClip(
  sessionId: string,
  promptKey: keyof ImagePromptAnswers,
  clipId: string,
) {
  const sessionRef = doc(db, 'storySessions', sessionId);
  const snap = await getDoc(sessionRef);
  const imageStimulus = snap.data()?.imageStimulus as ImageStimulusData | undefined;
  if (!imageStimulus) return;

  const entry = imageStimulus.prompts[promptKey];
  const clipOrder = (entry?.clipOrder ?? []).filter((id) => id !== clipId);
  const prompts = mergePromptAnswers(imageStimulus.prompts ?? {}, promptKey, { clipOrder });
  const readerText = composeImageStoryReaderText({ ...imageStimulus, prompts });

  await updateDoc(sessionRef, {
    imageStimulus: stripUndefined({ ...imageStimulus, prompts }),
    editedDraft: readerText || null,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'clips', clipId), { status: 'error', errorMessage: 'removed' });
}

export async function finishPhotoOnlyStory(sessionId: string) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });
}

export async function markContributorStorySubmitted(sessionId: string) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    contributorSubmitted: true,
    updatedAt: serverTimestamp(),
  });
}

export async function reorderClips(sessionId: string, clipOrder: string[]) {
  const batch = writeBatch(db);
  clipOrder.forEach((clipId, index) => {
    batch.update(doc(db, 'clips', clipId), { order: index });
  });
  batch.update(doc(db, 'storySessions', sessionId), {
    clipOrder,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteClip(sessionId: string, clipId: string, currentOrder: string[]) {
  const newOrder = currentOrder.filter((id) => id !== clipId);
  await reorderClips(sessionId, newOrder);
  // Soft-delete: mark clip as removed (keep storage for now)
  await updateDoc(doc(db, 'clips', clipId), { status: 'error', errorMessage: 'removed' });
}

export async function markSessionComplete(sessionId: string) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    status: 'transcribing',
    readyToGenerate: true,
    updatedAt: serverTimestamp(),
  });
}

async function resolveCollabBookIdForPrompts(bookId: string): Promise<string | null> {
  const collabSnap = await getDoc(doc(db, 'collabBooks', bookId));
  if (collabSnap.exists()) return bookId;

  const albumSnap = await getDoc(doc(db, 'books', bookId));
  if (!albumSnap.exists()) return null;

  const collabBookId = albumSnap.data()?.collabBookId as string | undefined;
  return collabBookId ?? null;
}

export async function markStimulusComplete(
  userId: string,
  stimulusId: string,
  bookId?: string,
  collabBookId?: string,
) {
  const targetCollabId =
    collabBookId ?? (bookId ? await resolveCollabBookIdForPrompts(bookId) : null);
  if (targetCollabId) {
    await markPromptComplete(targetCollabId, userId, stimulusId);
    return;
  }
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const progress = snap.data()?.stimulusProgress ?? { completedStimulusIds: [], currentIndex: 0 };
  if (!progress.completedStimulusIds.includes(stimulusId)) {
    await updateDoc(userRef, {
      stimulusProgress: {
        completedStimulusIds: [...progress.completedStimulusIds, stimulusId],
        currentIndex: progress.currentIndex + 1,
      },
      updatedAt: serverTimestamp(),
    });
  }
}

export function subscribeToBookStories(bookId: string, cb: (sessions: StorySession[]) => void) {
  const q = query(
    collection(db, 'storySessions'),
    where('bookId', '==', bookId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => mapSession(d.id, d.data())));
    },
    (err) => {
      console.error('subscribeToBookStories failed:', err);
      cb([]);
    },
  );
}

/** Contributor stories live under the contributor's userId — book owners must query by bookOwnerId. */
export function subscribeToContributorSubmissions(
  bookOwnerId: string,
  cb: (sessions: StorySession[]) => void,
) {
  const q = query(
    collection(db, 'storySessions'),
    where('bookOwnerId', '==', bookOwnerId),
    where('isContributorStory', '==', true),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => mapSession(d.id, d.data())));
    },
    (err) => {
      console.error('subscribeToContributorSubmissions failed:', err);
      cb([]);
    },
  );
}

export async function updateStoryTitle(sessionId: string, title: string) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    title: title.trim(),
    updatedAt: serverTimestamp(),
  });
}

/** Set story + unnamed photo block titles after the user names a photo story. */
export async function applyPhotoStoryName(
  sessionId: string,
  session: StorySession,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Story name is required');

  const title =
    session.isContributorStory && session.contributorName
      ? `${session.contributorName} — ${trimmed}`
      : trimmed;

  await updateStoryTitle(sessionId, title);

  const { order, blocks } = resolveStoryBlocks(session);
  for (const blockId of order) {
    const block = blocks[blockId];
    if (block?.type === 'image' && !block.title?.trim()) {
      await updateImageBlockMeta(sessionId, blockId, { title: trimmed });
    }
  }
}

/** Upload a short clip used only to capture a spoken story name, then return its transcript. */
export async function transcribeSpokenName(
  userId: string,
  sessionId: string,
  blob: Blob,
  durationSeconds: number,
): Promise<string> {
  const clipRef = await addDoc(
    collection(db, 'clips'),
    stripUndefined({
      storySessionId: sessionId,
      userId,
      order: -1,
      purpose: 'title',
      storagePath: '',
      durationSeconds,
      status: 'uploading',
      createdAt: serverTimestamp(),
    }),
  );

  const clipId = clipRef.id;
  const storagePath = `stories/${userId}/${sessionId}/clips/${clipId}/audio.webm`;
  const storageRefObj = ref(storage, storagePath);
  const contentType =
    blob.type.startsWith('audio/') || blob.type === 'video/webm' ? blob.type : 'audio/webm';

  await new Promise<void>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRefObj, blob, { contentType });
    uploadTask.on(
      'state_changed',
      undefined,
      (err) => reject(err),
      () => resolve(),
    );
  });

  await updateDoc(doc(db, 'clips', clipId), {
    storagePath,
    audioUrl: await getDownloadURL(storageRefObj),
    status: 'transcribing',
  });

  const text = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsub();
      reject(new Error('Name transcription timed out — try typing instead.'));
    }, 90_000);

    const unsub = onSnapshot(doc(db, 'clips', clipId), (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.status === 'ready' && data.transcript?.text) {
        window.clearTimeout(timeout);
        unsub();
        const spoken = String(data.transcript.text).trim();
        updateDoc(doc(db, 'clips', clipId), { status: 'error', errorMessage: 'removed' });
        resolve(spoken);
      } else if (data.status === 'error' && data.errorMessage !== 'removed') {
        window.clearTimeout(timeout);
        unsub();
        reject(new Error(data.errorMessage || 'Transcription failed'));
      }
    });
  });

  return text;
}

export function subscribeToSessions(userId: string, cb: (sessions: StorySession[]) => void) {
  const q = query(
    collection(db, 'storySessions'),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapSession(d.id, d.data())));
  });
}

export function subscribeToSession(sessionId: string, cb: (s: StorySession | null) => void) {
  return onSnapshot(doc(db, 'storySessions', sessionId), (snap) => {
    cb(snap.exists() ? mapSession(snap.id, snap.data()) : null);
  });
}

export function subscribeToClips(sessionId: string, cb: (clips: AudioClip[]) => void) {
  const q = query(collection(db, 'clips'), where('storySessionId', '==', sessionId));
  return onSnapshot(q, (snap) => {
    const clips = snap.docs
      .map((d) => mapClip(d.id, d.data()))
      .filter((c) => c.errorMessage !== 'removed')
      .sort((a, b) => a.order - b.order);
    cb(clips);
  });
}

export async function updateSessionDraft(sessionId: string, editedDraft: string) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    editedDraft,
    updatedAt: serverTimestamp(),
  });
}

export async function approveSession(sessionId: string, notes?: string) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    status: 'approved',
    buyerNotes: notes ?? '',
    updatedAt: serverTimestamp(),
  });
}

export async function rejectSession(sessionId: string, notes: string) {
  const snap = await getDoc(doc(db, 'storySessions', sessionId));
  const isContributor = snap.data()?.isContributorStory === true;
  await updateDoc(doc(db, 'storySessions', sessionId), {
    status: isContributor ? 'recording' : 'rejected',
    buyerNotes: notes,
    ...(isContributor ? { contributorSubmitted: false } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Book owner removes a contributor submission (and its clips). */
export async function deleteStorySession(sessionId: string): Promise<void> {
  const clipsQ = query(collection(db, 'clips'), where('storySessionId', '==', sessionId));
  const snap = await getDocs(clipsQ);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'storySessions', sessionId));
  await batch.commit();
}

/** Remove a story from chapter lists, then delete the session and its clips. */
export async function deleteBookStory(sessionId: string, chapters: Chapter[]): Promise<void> {
  const batch = writeBatch(db);
  let chapterUpdates = 0;
  for (const chapter of chapters) {
    if (!chapter.storyOrder.includes(sessionId)) continue;
    batch.update(doc(db, 'chapters', chapter.id), {
      storyOrder: chapter.storyOrder.filter((id) => id !== sessionId),
      updatedAt: serverTimestamp(),
    });
    chapterUpdates += 1;
  }
  if (chapterUpdates > 0) {
    await batch.commit();
  }
  await deleteStorySession(sessionId);
}

export async function updateImageStimulus(sessionId: string, imageStimulus: ImageStimulusData) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    imageStimulus: stripUndefined(imageStimulus),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTextStimulus(sessionId: string, textStimulus: TextStimulusData) {
  await updateDoc(doc(db, 'storySessions', sessionId), {
    textStimulus: stripUndefined(textStimulus),
    updatedAt: serverTimestamp(),
  });
}

/** Re-run cloud transcription for a clip that failed or stalled. */
export async function retryClipTranscription(clipId: string): Promise<void> {
  const fn = httpsCallable<{ clipId: string }, { ok: boolean }>(functions, 'retryClipTranscription');
  await fn({ clipId });
}
