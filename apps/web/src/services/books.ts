import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { generatePublicSlug } from '@/lib/slug';
import { sortStoriesByTimeline, timelineInsertIndex } from '@/lib/storyTimeline';
import type { Book, Chapter, StorySession, StoryAttachment, AudioClip } from '@/types';

function mapBook(id: string, data: Record<string, unknown>): Book {
  return {
    id,
    userId: data.userId as string,
    title: data.title as string,
    authorName: data.authorName as string,
    publicSlug: data.publicSlug as string,
    isPublished: (data.isPublished as boolean) ?? false,
    chapterOrder: (data.chapterOrder as string[]) ?? [],
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
  };
}

function mapChapter(id: string, data: Record<string, unknown>): Chapter {
  return {
    id,
    bookId: data.bookId as string,
    userId: data.userId as string,
    title: data.title as string,
    order: data.order as number,
    storyOrder: (data.storyOrder as string[]) ?? [],
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
  };
}

function isPlaceholderAuthor(name: string): boolean {
  const n = name.trim().toLowerCase();
  return !n || n === 'author' || n === 'my story';
}

export async function getOrCreateBook(
  userId: string,
  authorName: string,
): Promise<Book> {
  const resolvedAuthor = authorName.trim();

  const q = query(collection(db, 'books'), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    const book = mapBook(d.id, d.data());
    if (resolvedAuthor && isPlaceholderAuthor(book.authorName)) {
      await updateDoc(doc(db, 'books', book.id), {
        authorName: resolvedAuthor,
        updatedAt: serverTimestamp(),
      });
      return { ...book, authorName: resolvedAuthor };
    }
    return book;
  }

  const finalAuthor = resolvedAuthor || 'My Story';

  const bookRef = await addDoc(collection(db, 'books'), {
    userId,
    title: 'My Life Story',
    authorName: finalAuthor,
    publicSlug: generatePublicSlug(finalAuthor, userId),
    isPublished: false,
    chapterOrder: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, 'users', userId),
    { bookId: bookRef.id, updatedAt: serverTimestamp() },
    { merge: true },
  );

  const chapterRef = await addDoc(collection(db, 'chapters'), {
    bookId: bookRef.id,
    userId,
    title: 'Chapter 1',
    order: 0,
    storyOrder: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'books', bookRef.id), {
    chapterOrder: [chapterRef.id],
    updatedAt: serverTimestamp(),
  });

  return {
    id: bookRef.id,
    userId,
    title: 'My Life Story',
    authorName: finalAuthor,
    publicSlug: generatePublicSlug(finalAuthor, userId),
    isPublished: false,
    chapterOrder: [chapterRef.id],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function subscribeToBook(bookId: string, cb: (book: Book | null) => void) {
  return onSnapshot(doc(db, 'books', bookId), (snap) => {
    cb(snap.exists() ? mapBook(snap.id, snap.data()) : null);
  });
}

export function subscribeToChapters(
  bookId: string,
  userId: string,
  cb: (chapters: Chapter[]) => void,
) {
  const q = query(
    collection(db, 'chapters'),
    where('bookId', '==', bookId),
    where('userId', '==', userId),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs
          .map((d) => mapChapter(d.id, d.data()))
          .sort((a, b) => a.order - b.order),
      );
    },
    (err) => console.error('chapters subscription error:', err),
  );
}

export async function getBookBySlug(slug: string): Promise<Book | null> {
  const q = query(collection(db, 'books'), where('publicSlug', '==', slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapBook(d.id, d.data());
}

export async function getBookById(bookId: string): Promise<Book | null> {
  const snap = await getDoc(doc(db, 'books', bookId));
  if (!snap.exists()) return null;
  return mapBook(snap.id, snap.data());
}

export async function createChapter(bookId: string, userId: string, title: string) {
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  const chapterOrder = (bookSnap.data()?.chapterOrder as string[]) ?? [];

  const chapterRef = await addDoc(collection(db, 'chapters'), {
    bookId,
    userId,
    title,
    order: chapterOrder.length,
    storyOrder: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'books', bookId), {
    chapterOrder: [...chapterOrder, chapterRef.id],
    updatedAt: serverTimestamp(),
  });

  return chapterRef.id;
}

export async function updateChapterTitle(chapterId: string, title: string) {
  await updateDoc(doc(db, 'chapters', chapterId), { title, updatedAt: serverTimestamp() });
}

export async function reorderChapters(bookId: string, chapterOrder: string[]) {
  const batch = writeBatch(db);
  chapterOrder.forEach((id, index) => {
    batch.update(doc(db, 'chapters', id), { order: index, updatedAt: serverTimestamp() });
  });
  batch.update(doc(db, 'books', bookId), { chapterOrder, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function moveStoryToChapter(
  storyId: string,
  fromChapterId: string | null,
  toChapterId: string,
  storiesById: Map<string, StorySession>,
  autoSort = true,
) {
  const toChapterRef = doc(db, 'chapters', toChapterId);
  const toSnap = await getDoc(toChapterRef);
  if (!toSnap.exists()) return;

  const story = storiesById.get(storyId);
  const batch = writeBatch(db);
  let toOrder = [...((toSnap.data().storyOrder as string[]) ?? [])];

  if (fromChapterId && fromChapterId !== toChapterId) {
    const fromSnap = await getDoc(doc(db, 'chapters', fromChapterId));
    if (fromSnap.exists()) {
      const fromOrder = ((fromSnap.data().storyOrder as string[]) ?? []).filter(
        (id) => id !== storyId,
      );
      batch.update(doc(db, 'chapters', fromChapterId), {
        storyOrder: fromOrder,
        updatedAt: serverTimestamp(),
      });
    }
    toOrder = toOrder.filter((id) => id !== storyId);
  } else if (fromChapterId === toChapterId) {
    toOrder = toOrder.filter((id) => id !== storyId);
  }

  const toIndex =
    autoSort && story
      ? timelineInsertIndex(story, toOrder, storiesById)
      : toOrder.length;

  toOrder.splice(toIndex, 0, storyId);
  batch.update(toChapterRef, { storyOrder: toOrder, updatedAt: serverTimestamp() });

  const bookId = toSnap.data().bookId as string;
  batch.update(doc(db, 'storySessions', storyId), {
    bookId,
    chapterId: toChapterId,
    chapterOrder: toIndex,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function autoSortChapterStories(
  chapterId: string,
  storiesById: Map<string, StorySession>,
) {
  const chapterRef = doc(db, 'chapters', chapterId);
  const snap = await getDoc(chapterRef);
  if (!snap.exists()) return;

  const storyOrder = (snap.data().storyOrder as string[]) ?? [];
  const stories = storyOrder
    .map((id) => storiesById.get(id))
    .filter(Boolean) as StorySession[];
  const sorted = sortStoriesByTimeline(stories).map((s) => s.id);

  await reorderStoriesInChapter(chapterId, sorted);
}

export async function reorderStoriesInChapter(chapterId: string, storyOrder: string[]) {
  const batch = writeBatch(db);
  storyOrder.forEach((storyId, index) => {
    batch.update(doc(db, 'storySessions', storyId), {
      chapterOrder: index,
      updatedAt: serverTimestamp(),
    });
  });
  batch.update(doc(db, 'chapters', chapterId), {
    storyOrder,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function assignStoryToBook(
  storyId: string,
  bookId: string,
  chapterId: string,
) {
  const chapterSnap = await getDoc(doc(db, 'chapters', chapterId));
  const storyOrder = [...((chapterSnap.data()?.storyOrder as string[]) ?? []), storyId];
  const publicSlug = generatePublicSlug(
    (await getDoc(doc(db, 'storySessions', storyId))).data()?.title as string ?? 'story',
    storyId,
  );

  await updateDoc(doc(db, 'chapters', chapterId), {
    storyOrder,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'storySessions', storyId), {
    bookId,
    chapterId,
    chapterOrder: storyOrder.length - 1,
    publicSlug,
    updatedAt: serverTimestamp(),
  });
}

export async function publishBook(bookId: string, publish: boolean) {
  await updateDoc(doc(db, 'books', bookId), {
    isPublished: publish,
    updatedAt: serverTimestamp(),
  });
}

export async function updateBookTitle(bookId: string, title: string) {
  await updateDoc(doc(db, 'books', bookId), { title, updatedAt: serverTimestamp() });
}

async function fetchBookBundle(bookId: string, ownerUserId?: string) {
  let chapters: ReturnType<typeof mapChapter>[] = [];
  try {
    const chaptersSnap = await getDocs(
      query(collection(db, 'chapters'), where('bookId', '==', bookId)),
    );
    chapters = chaptersSnap.docs
      .map((d) => mapChapter(d.id, d.data()))
      .sort((a, b) => a.order - b.order);
  } catch (err) {
    console.error('fetchBookBundle chapters:', err);
  }

  let stories: StorySession[] = [];
  try {
    const storiesSnap = await getDocs(
      query(collection(db, 'storySessions'), where('bookId', '==', bookId)),
    );
    stories = storiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as StorySession[];
  } catch (err) {
    console.error('fetchBookBundle stories by bookId:', err);
    if (ownerUserId) {
      try {
        const userStoriesSnap = await getDocs(
          query(collection(db, 'storySessions'), where('userId', '==', ownerUserId)),
        );
        stories = userStoriesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => (s as StorySession).bookId === bookId) as StorySession[];
      } catch (fallbackErr) {
        console.error('fetchBookBundle stories fallback:', fallbackErr);
      }
    }
  }

  const clips: AudioClip[] = [];
  for (const story of stories) {
    try {
      const storyClipsSnap = await getDocs(
        query(collection(db, 'clips'), where('storySessionId', '==', story.id)),
      );
      clips.push(
        ...storyClipsSnap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((c) => (c as { errorMessage?: string }).errorMessage !== 'removed') as AudioClip[],
      );
    } catch (err) {
      console.error('fetchBookBundle clips for story', story.id, err);
    }
  }

  return { chapters, stories, clips };
}

export async function getBookPreviewData(bookId: string, userId: string) {
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  if (!bookSnap.exists()) return null;
  const book = mapBook(bookSnap.id, bookSnap.data());
  if (book.userId !== userId) return null;
  const bundle = await fetchBookBundle(bookId, userId);
  return { book, ...bundle };
}

export async function getPublishedBookData(slug: string) {
  const book = await getBookBySlug(slug);
  if (!book || !book.isPublished) return null;
  const bundle = await fetchBookBundle(book.id, book.userId);
  return { book, ...bundle };
}

export async function getClipForListen(
  bookSlug: string,
  clipId: string,
): Promise<{ book: Book; clip: AudioClip; storyTitle: string } | null> {
  const book = await getBookBySlug(bookSlug);
  if (!book) return null;

  const clipSnap = await getDoc(doc(db, 'clips', clipId));
  if (!clipSnap.exists()) return null;
  const clip = { id: clipSnap.id, ...clipSnap.data() } as AudioClip;

  const storySnap = await getDoc(doc(db, 'storySessions', clip.storySessionId));
  if (!storySnap.exists()) return null;
  const story = storySnap.data();
  if (story.bookId !== book.id) return null;

  return {
    book,
    clip,
    storyTitle: (story.title as string) ?? 'Story',
  };
}

export async function getStoryByPublicSlug(
  bookSlug: string,
  storySlug: string,
): Promise<{ book: Book; story: StorySession; clips: unknown[] } | null> {
  const book = await getBookBySlug(bookSlug);
  if (!book || !book.isPublished) return null;

  const q = query(
    collection(db, 'storySessions'),
    where('bookId', '==', book.id),
    where('publicSlug', '==', storySlug),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const storyDoc = snap.docs[0];
  const story = { id: storyDoc.id, ...storyDoc.data() } as StorySession;

  const clipsQ = query(
    collection(db, 'clips'),
    where('storySessionId', '==', storyDoc.id),
  );
  const clipsSnap = await getDocs(clipsQ);
  const clips = clipsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => ((a as { order: number }).order ?? 0) - ((b as { order: number }).order ?? 0));

  return { book, story, clips };
}

export async function addStoryAttachment(
  storyId: string,
  attachment: Omit<StoryAttachment, 'id' | 'createdAt'>,
) {
  const storyRef = doc(db, 'storySessions', storyId);
  const snap = await getDoc(storyRef);
  const existing = (snap.data()?.attachments as StoryAttachment[]) ?? [];
  const newAttachment: StoryAttachment = {
    ...attachment,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  await updateDoc(storyRef, {
    attachments: [...existing, newAttachment],
    updatedAt: serverTimestamp(),
  });
}

export async function uploadStoryAttachment(
  userId: string,
  storyId: string,
  file: File,
  title?: string,
) {
  const storagePath = `stories/${userId}/${storyId}/attachments/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytesResumable(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  await addStoryAttachment(storyId, {
    type: file.type.startsWith('video/') ? 'video' : 'image',
    url,
    title,
    storagePath,
  });
}

export async function updateEditedTranscript(storyId: string, editedTranscript: string) {
  await updateDoc(doc(db, 'storySessions', storyId), {
    editedTranscript,
    updatedAt: serverTimestamp(),
  });
}

export async function addLinkAttachment(storyId: string, url: string, title: string) {
  await addStoryAttachment(storyId, { type: 'link', url, title });
}

export async function removeAttachment(storyId: string, attachmentId: string) {
  const snap = await getDoc(doc(db, 'storySessions', storyId));
  const attachments = ((snap.data()?.attachments as StoryAttachment[]) ?? []).filter(
    (a) => a.id !== attachmentId,
  );
  await updateDoc(doc(db, 'storySessions', storyId), {
    attachments,
    updatedAt: serverTimestamp(),
  });
}
