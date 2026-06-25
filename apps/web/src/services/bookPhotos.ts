import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { uploadFileAndGetUrl } from '@/lib/storageUpload';
import { PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';
import { createStoryInBook, type CollabBookRef } from '@/services/bookStructure';
import { addImageBlockFromStorage } from '@/services/storyBlocks';
import type { CreateSessionOpts } from '@/services/storySessions';
import type { BookPhoto } from '@/types';
import { getNextInQueue } from '@/lib/turnQueue';
import { skipBookPhotoInQueue } from '@/services/bookPrompts';

function toDate(value: unknown): Date {
  return (value as { toDate: () => Date })?.toDate?.() ?? new Date();
}

function photosCol(bookId: string) {
  return collection(db, 'collabBooks', bookId, 'photos');
}

function mapPhoto(bookId: string, id: string, data: Record<string, unknown>): BookPhoto {
  return {
    id,
    bookId,
    imageUrl: data.imageUrl as string,
    imageStoragePath: data.imageStoragePath as string,
    date: data.date as string | undefined,
    year: data.year as number | undefined,
    status:
      (data.status as BookPhoto['status']) === 'skipped'
        ? 'pending'
        : ((data.status as BookPhoto['status']) ?? 'pending'),
    storySessionId: data.storySessionId as string | undefined,
    createdBy: data.createdBy as string,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeToBookPhotos(
  bookId: string,
  callback: (photos: BookPhoto[]) => void,
): () => void {
  const q = query(photosCol(bookId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapPhoto(bookId, d.id, d.data())));
    },
    (err) => {
      console.error('book photos subscription failed:', err);
      callback([]);
    },
  );
}

export async function uploadBookPhoto(
  bookId: string,
  userId: string,
  file: File,
  meta?: { date?: string; year?: number },
): Promise<string> {
  const fileKey = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const imageStoragePath = `stories/${userId}/book-photos-${bookId}/images/${fileKey}`;
  const storageRef = ref(storage, imageStoragePath);

  let imageUrl: string;
  try {
    imageUrl = await uploadFileAndGetUrl(storageRef, file);
  } catch (err) {
    await deleteObject(storageRef).catch(() => undefined);
    throw err;
  }

  try {
    const photoRef = await addDoc(photosCol(bookId), {
      bookId,
      imageUrl,
      imageStoragePath,
      status: 'pending',
      createdBy: userId,
      ...(meta?.date ? { date: meta.date } : {}),
      ...(meta?.year ? { year: meta.year } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return photoRef.id;
  } catch (err) {
    await deleteObject(storageRef).catch(() => undefined);
    throw err;
  }
}

export async function deleteBookPhoto(bookId: string, photoId: string) {
  await deleteDoc(doc(db, 'collabBooks', bookId, 'photos', photoId));
}

/** Defer this photo to the back of the Home queue. */
export async function skipBookPhoto(bookId: string, userId: string, photoId: string) {
  await skipBookPhotoInQueue(bookId, userId, photoId);
}

export async function markBookPhotoInProgress(
  bookId: string,
  photoId: string,
  storySessionId: string,
) {
  const photoRef = doc(db, 'collabBooks', bookId, 'photos', photoId);
  await setDoc(
    photoRef,
    {
      status: 'in_progress',
      storySessionId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Story finished — remove from photo inventory (image lives on in the story). */
export async function completeBookPhoto(bookId: string, photoId: string) {
  await deleteBookPhoto(bookId, photoId);
}

/** Remove any library photo tied to this story session (survives lost navigation state). */
export async function completeBookPhotoForStory(
  collabBookId: string,
  storySessionId: string,
): Promise<void> {
  const snap = await getDocs(
    query(photosCol(collabBookId), where('storySessionId', '==', storySessionId)),
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

const INVENTORY_STORY_DONE = new Set(['approved', 'ready', 'pending_approval']);

/** Drop photos whose linked story was already finished (e.g. before auto-removal existed). */
export async function pruneInventoryPhotosWithFinishedStories(
  collabBookId: string,
  photos: BookPhoto[],
): Promise<void> {
  const linked = photos.filter((p) => p.storySessionId);
  await Promise.all(
    linked.map(async (photo) => {
      const storySnap = await getDoc(doc(db, 'storySessions', photo.storySessionId!));
      if (!storySnap.exists()) return;
      const status = storySnap.data()?.status as string | undefined;
      if (status && INVENTORY_STORY_DONE.has(status)) {
        await deleteBookPhoto(collabBookId, photo.id);
      }
    }),
  );
}

export async function startStoryFromBookPhoto(
  photo: BookPhoto,
  collabBook: CollabBookRef,
  authorName: string,
  sessionOpts: Pick<
    CreateSessionOpts,
    'userId' | 'languageHint' | 'hindiOutputMode' | 'perspective'
  >,
): Promise<string> {
  if (photo.storySessionId && photo.status === 'in_progress') {
    return photo.storySessionId;
  }

  const sessionId = await createStoryInBook(
    {
      ...sessionOpts,
      bookId: collabBook.id,
      title: PHOTO_STORY_PLACEHOLDER,
      sourceType: 'image_stimulus',
    },
    collabBook,
    authorName,
  );

  await addImageBlockFromStorage(sessionId, {
    title: '',
    imageUrl: photo.imageUrl,
    imageStoragePath: photo.imageStoragePath,
    date: photo.date,
    year: photo.year,
  });

  await markBookPhotoInProgress(collabBook.id, photo.id, sessionId);
  return sessionId;
}

export function photoIsReady(photo: BookPhoto): boolean {
  return !!photo.imageStoragePath?.trim();
}

export function inventoryPhotos(photos: BookPhoto[]): BookPhoto[] {
  return photos.filter(
    (p) => photoIsReady(p) && (p.status === 'pending' || p.status === 'in_progress'),
  );
}

export function nextActionablePhoto(
  photos: BookPhoto[],
  skippedPhotoIds: string[] = [],
): BookPhoto | null {
  const inProgress = photos.find(
    (p) => p.status === 'in_progress' && photoIsReady(p),
  );
  if (inProgress) return inProgress;

  const pending = photos.filter((p) => p.status === 'pending' && photoIsReady(p));
  return getNextInQueue(
    pending,
    [],
    skippedPhotoIds,
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export function pendingPhotoCount(photos: BookPhoto[]): number {
  return photos.filter(
    (p) => photoIsReady(p) && (p.status === 'pending' || p.status === 'in_progress'),
  ).length;
}
