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
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type {
  Recording,
  Story,
  TranscriptLanguage,
  HindiOutputMode,
  StoryPerspective,
} from '@/types';

function mapRecording(id: string, data: Record<string, unknown>): Recording {
  return {
    id,
    userId: data.userId as string,
    bookId: data.bookId as string | undefined,
    buyerId: data.buyerId as string | undefined,
    title: data.title as string,
    storagePath: data.storagePath as string,
    audioUrl: data.audioUrl as string | undefined,
    durationSeconds: data.durationSeconds as number | undefined,
    languageHint: data.languageHint as TranscriptLanguage | undefined,
    hindiOutputMode: (data.hindiOutputMode as HindiOutputMode) ?? 'hindi_script',
    status: data.status as Recording['status'],
    errorMessage: data.errorMessage as string | undefined,
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
  };
}

function mapStory(id: string, data: Record<string, unknown>): Story {
  return {
    id,
    recordingId: data.recordingId as string,
    userId: data.userId as string,
    bookId: data.bookId as string | undefined,
    buyerId: data.buyerId as string | undefined,
    title: data.title as string,
    transcript: data.transcript as Story['transcript'],
    draft: data.draft as string,
    editedDraft: data.editedDraft as string | undefined,
    perspective: data.perspective as StoryPerspective,
    outputLanguage: data.outputLanguage as 'en' | 'hi',
    status: data.status as Story['status'],
    buyerNotes: data.buyerNotes as string | undefined,
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function uploadRecording(
  userId: string,
  blob: Blob,
  opts: {
    title: string;
    durationSeconds: number;
    languageHint: TranscriptLanguage;
    hindiOutputMode: HindiOutputMode;
    bookId?: string;
  },
  onProgress?: (pct: number) => void,
): Promise<string> {
  const recordingRef = await addDoc(collection(db, 'recordings'), {
    userId,
    bookId: opts.bookId ?? '',
    title: opts.title,
    storagePath: '',
    durationSeconds: opts.durationSeconds,
    languageHint: opts.languageHint,
    hindiOutputMode: opts.hindiOutputMode,
    status: 'uploading',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const recordingId = recordingRef.id;
  const storagePath = `recordings/${userId}/${recordingId}/audio.webm`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: blob.type });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snap) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        onProgress?.(pct);
      },
      reject,
      async () => {
        const audioUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'recordings', recordingId), {
          storagePath,
          audioUrl,
          status: 'transcribing',
          updatedAt: serverTimestamp(),
        });
        resolve(recordingId);
      },
    );
  });
}

export function subscribeToRecordings(
  userId: string,
  bookId: string,
  callback: (recordings: Recording[]) => void,
) {
  const q = query(
    collection(db, 'recordings'),
    where('userId', '==', userId),
    where('bookId', '==', bookId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapRecording(d.id, d.data())));
  });
}

export function subscribeToRecording(
  recordingId: string,
  callback: (recording: Recording | null) => void,
) {
  return onSnapshot(doc(db, 'recordings', recordingId), (snap) => {
    callback(snap.exists() ? mapRecording(snap.id, snap.data()) : null);
  });
}

export async function getStoryForRecording(recordingId: string): Promise<Story | null> {
  const q = query(collection(db, 'stories'), where('recordingId', '==', recordingId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapStory(d.id, d.data());
}

export function subscribeToStory(
  storyId: string,
  callback: (story: Story | null) => void,
) {
  return onSnapshot(doc(db, 'stories', storyId), (snap) => {
    callback(snap.exists() ? mapStory(snap.id, snap.data()) : null);
  });
}

export async function updateStoryDraft(storyId: string, editedDraft: string) {
  await updateDoc(doc(db, 'stories', storyId), {
    editedDraft,
    updatedAt: serverTimestamp(),
  });
}

export async function approveStory(storyId: string, notes?: string) {
  await updateDoc(doc(db, 'stories', storyId), {
    status: 'approved',
    buyerNotes: notes ?? '',
    updatedAt: serverTimestamp(),
  });
}

export async function rejectStory(storyId: string, notes: string) {
  await updateDoc(doc(db, 'stories', storyId), {
    status: 'rejected',
    buyerNotes: notes,
    updatedAt: serverTimestamp(),
  });
}

export async function getRecording(recordingId: string): Promise<Recording | null> {
  const snap = await getDoc(doc(db, 'recordings', recordingId));
  return snap.exists() ? mapRecording(snap.id, snap.data()) : null;
}
