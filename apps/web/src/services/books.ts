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
import { stripUndefined } from '@/lib/firestoreUtils';
import { mapAudioClip, mapStorySession } from '@/services/storySessions';
import { generatePublicSlug } from '@/lib/slug';
import { sortStoriesByTimeline, timelineInsertIndex } from '@/lib/storyTimeline';
import type { Book, Chapter, StorySession, StoryAttachment, AudioClip } from '@/types';
import { getPublicBookByToken } from '@/services/booksCollaboration';

function mapBook(id: string, data: Record<string, unknown>): Book {
  return {
    id,
    userId: data.userId as string,
    collabBookId: data.collabBookId as string | undefined,
    title: data.title as string,
    authorName: data.authorName as string,
    publicSlug: data.publicSlug as string,
    isPublished: (data.isPublished as boolean) ?? false,
    chapterOrder: (data.chapterOrder as string[]) ?? [],
    savedPdfUrl: data.savedPdfUrl as string | undefined,
    savedPdfAt: (data.savedPdfAt as { toDate: () => Date })?.toDate?.(),
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

/** Album book linked to the active collab book — one published album per collabBooks entry. */
export async function getOrCreateAlbumBookForCollab(
  userId: string,
  collabBook: { id: string; title: string },
  authorName: string,
): Promise<Book> {
  const linked = await getDocs(
    query(
      collection(db, 'books'),
      where('userId', '==', userId),
      where('collabBookId', '==', collabBook.id),
    ),
  );

  if (!linked.empty) {
    const d = linked.docs[0];
    let book = mapBook(d.id, d.data());
    const resolvedAuthor = authorName.trim();
    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    let needsUpdate = false;

    if (book.title !== collabBook.title) {
      patch.title = collabBook.title;
      book = { ...book, title: collabBook.title };
      needsUpdate = true;
    }
    if (resolvedAuthor && isPlaceholderAuthor(book.authorName)) {
      patch.authorName = resolvedAuthor;
      book = { ...book, authorName: resolvedAuthor };
      needsUpdate = true;
    }
    if (needsUpdate) {
      await updateDoc(doc(db, 'books', book.id), patch);
    }
    return book;
  }

  const finalAuthor = authorName.trim() || 'My Story';

  const bookRef = await addDoc(collection(db, 'books'), {
    userId,
    collabBookId: collabBook.id,
    title: collabBook.title,
    authorName: finalAuthor,
    publicSlug: generatePublicSlug(`${collabBook.title}-${collabBook.id.slice(0, 8)}`, userId),
    isPublished: false,
    chapterOrder: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

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
    collabBookId: collabBook.id,
    title: collabBook.title,
    authorName: finalAuthor,
    publicSlug: generatePublicSlug(`${collabBook.title}-${collabBook.id.slice(0, 8)}`, userId),
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

export async function getBookBySlug(
  slug: string,
  options?: { publishedOnly?: boolean },
): Promise<Book | null> {
  const constraints = [
    where('publicSlug', '==', slug),
    ...(options?.publishedOnly ? [where('isPublished', '==', true)] : []),
  ];
  const q = query(collection(db, 'books'), ...constraints);
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
  let collabBookId: string | undefined;
  const albumSnap = await getDoc(doc(db, 'books', bookId));
  if (albumSnap.exists()) {
    collabBookId = albumSnap.data()?.collabBookId as string | undefined;
  }

  batch.update(doc(db, 'storySessions', storyId), {
    bookId,
    ...(collabBookId ? { collabBookId } : {}),
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

/** Link a story to the album book without filing it into a chapter. */
export async function linkStoryToCollabAlbum(
  storyId: string,
  albumBookId: string,
  collabBookId: string,
): Promise<void> {
  const storySnap = await getDoc(doc(db, 'storySessions', storyId));
  const publicSlug = generatePublicSlug(
    (storySnap.data()?.title as string) ?? 'story',
    storyId,
  );

  await updateDoc(doc(db, 'storySessions', storyId), {
    bookId: albumBookId,
    collabBookId,
    publicSlug,
    updatedAt: serverTimestamp(),
  });
}

export async function assignStoryToBook(
  storyId: string,
  bookId: string,
  chapterId: string,
  collabBookId?: string,
) {
  const chapterSnap = await getDoc(doc(db, 'chapters', chapterId));
  const storyOrder = [...((chapterSnap.data()?.storyOrder as string[]) ?? []), storyId];
  const publicSlug = generatePublicSlug(
    (await getDoc(doc(db, 'storySessions', storyId))).data()?.title as string ?? 'story',
    storyId,
  );

  let resolvedCollabId = collabBookId;
  if (!resolvedCollabId) {
    const albumSnap = await getDoc(doc(db, 'books', bookId));
    resolvedCollabId = albumSnap.data()?.collabBookId as string | undefined;
  }

  await updateDoc(doc(db, 'chapters', chapterId), {
    storyOrder,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'storySessions', storyId), {
    bookId,
    ...(resolvedCollabId ? { collabBookId: resolvedCollabId } : {}),
    chapterId,
    chapterOrder: storyOrder.length - 1,
    publicSlug,
    updatedAt: serverTimestamp(),
  });
}

export async function publishBook(bookId: string, publish: boolean) {
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  const collabBookId = bookSnap.data()?.collabBookId as string | undefined;

  await updateDoc(doc(db, 'books', bookId), {
    isPublished: publish,
    updatedAt: serverTimestamp(),
  });

  if (collabBookId) {
    await updateDoc(doc(db, 'collabBooks', collabBookId), {
      publishedAlbumBookId: publish ? bookId : null,
      updatedAt: serverTimestamp(),
    });
  } else if (publish) {
    await syncPublishedAlbumLinkForBook(bookId);
  }
}

/** Backfill collabBooks.publishedAlbumBookId for albums that were published before linking existed. */
export async function syncPublishedAlbumLinkForBook(bookId: string): Promise<void> {
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  if (!bookSnap.exists() || bookSnap.data()?.isPublished !== true) return;
  const collabBookId = bookSnap.data()?.collabBookId as string | undefined;
  if (!collabBookId) return;
  await updateDoc(doc(db, 'collabBooks', collabBookId), {
    publishedAlbumBookId: bookId,
    updatedAt: serverTimestamp(),
  });
}

export async function updateBookTitle(bookId: string, title: string) {
  await updateDoc(doc(db, 'books', bookId), { title, updatedAt: serverTimestamp() });
}

async function fetchStoriesForAlbum(
  albumBook: Book,
  chapters: ReturnType<typeof mapChapter>[],
  ownerUserId?: string,
): Promise<StorySession[]> {
  const byId = new Map<string, StorySession>();

  const addFromSnap = (docs: { id: string; data: () => Record<string, unknown> }[]) => {
    for (const d of docs) {
      byId.set(d.id, mapStorySession(d.id, d.data()));
    }
  };

  const bookIds = [albumBook.id];
  if (albumBook.collabBookId && albumBook.collabBookId !== albumBook.id) {
    bookIds.push(albumBook.collabBookId);
  }

  for (const bookId of bookIds) {
    try {
      const storiesSnap = await getDocs(
        query(collection(db, 'storySessions'), where('bookId', '==', bookId)),
      );
      addFromSnap(storiesSnap.docs);
    } catch (err) {
      console.error('fetchStoriesForAlbum by bookId:', bookId, err);
    }
  }

  const missingFromChapters = chapters.flatMap((ch) => ch.storyOrder).filter((id) => !byId.has(id));
  for (const storyId of missingFromChapters) {
    try {
      const storySnap = await getDoc(doc(db, 'storySessions', storyId));
      if (storySnap.exists()) {
        byId.set(storyId, mapStorySession(storySnap.id, storySnap.data()));
      }
    } catch (err) {
      console.error('fetchStoriesForAlbum story doc:', storyId, err);
    }
  }

  if (byId.size === 0 && ownerUserId) {
    try {
      const userStoriesSnap = await getDocs(
        query(collection(db, 'storySessions'), where('userId', '==', ownerUserId)),
      );
      for (const d of userStoriesSnap.docs) {
        const story = mapStorySession(d.id, d.data());
        const matchesAlbum =
          story.bookId === albumBook.id ||
          (albumBook.collabBookId != null && story.bookId === albumBook.collabBookId) ||
          (story.chapterId != null && chapters.some((ch) => ch.storyOrder.includes(story.id)));
        if (matchesAlbum) byId.set(story.id, story);
      }
    } catch (err) {
      console.error('fetchStoriesForAlbum owner fallback:', err);
    }
  }

  return Array.from(byId.values());
}

async function fetchBookBundle(albumBook: Book | string, ownerUserId?: string) {
  const book =
    typeof albumBook === 'string' ? await getBookById(albumBook) : albumBook;
  if (!book) {
    return { chapters: [] as ReturnType<typeof mapChapter>[], stories: [] as StorySession[], clips: [] as AudioClip[] };
  }
  const bookId = book.id;

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

  const stories = await fetchStoriesForAlbum(book, chapters, ownerUserId);

  const clips: AudioClip[] = [];
  for (const story of stories) {
    try {
      const storyClipsSnap = await getDocs(
        query(collection(db, 'clips'), where('storySessionId', '==', story.id)),
      );
      clips.push(
        ...storyClipsSnap.docs
          .map((d) => mapAudioClip(d.id, d.data()))
          .filter((c) => c.errorMessage !== 'removed'),
      );
    } catch (err) {
      console.error('fetchBookBundle clips for story', story.id, err);
    }
  }

  return { chapters, stories, clips };
}

export async function getAlbumBookBundleForCollab(
  userId: string,
  collabBook: { id: string; title: string },
  authorName: string,
) {
  const album = await getOrCreateAlbumBookForCollab(userId, collabBook, authorName);
  return { album, ...(await fetchBookBundle(album, userId)) };
}

export async function getBookPreviewData(bookId: string, userId: string) {
  const bookSnap = await getDoc(doc(db, 'books', bookId));
  if (!bookSnap.exists()) return null;
  const book = mapBook(bookSnap.id, bookSnap.data());
  if (book.userId !== userId) return null;
  const bundle = await fetchBookBundle(book, userId);
  return { book, ...bundle };
}

export async function getPublishedBookData(slug: string) {
  const book = await getBookBySlug(slug, { publishedOnly: true });
  if (!book) return null;
  const bundle = await fetchBookBundle(book);
  return { book, ...bundle };
}

/** Live album bundle for /browse/:token — no login; requires active browse share on collab book. */
export async function getBrowsableAlbumBundle(albumBookId: string) {
  const book = await getBookById(albumBookId);
  if (!book) return null;
  const bundle = await fetchBookBundle(book);
  return { book, ...bundle };
}

export async function getBrowsableBookData(token: string) {
  const meta = await getPublicBookByToken(token);
  if (!meta) return null;

  let albumBookId = meta.albumBookId;
  if (!albumBookId) {
    try {
      const booksSnap = await getDocs(
        query(collection(db, 'books'), where('collabBookId', '==', meta.bookId)),
      );
      if (!booksSnap.empty) {
        albumBookId = booksSnap.docs[0].id;
      }
    } catch (err) {
      console.error('getBrowsableBookData album lookup:', err);
    }
  }
  if (!albumBookId) return null;

  return getBrowsableAlbumBundle(albumBookId);
}

export async function getClipForListen(
  bookSlug: string,
  clipId: string,
): Promise<{ book: Book; clip: AudioClip; storyTitle: string } | null> {
  const book = await getBookBySlug(bookSlug, { publishedOnly: true });
  if (!book) return null;

  const clipSnap = await getDoc(doc(db, 'clips', clipId));
  if (!clipSnap.exists()) return null;
  const clip = { id: clipSnap.id, ...clipSnap.data() } as AudioClip;

  const storySnap = await getDoc(doc(db, 'storySessions', clip.storySessionId));
  if (!storySnap.exists()) return null;
  const story = storySnap.data();
  const storyBookId = story.bookId as string | undefined;
  const storyOnAlbum =
    storyBookId === book.id ||
    (book.collabBookId != null && storyBookId === book.collabBookId);
  const storyInChapter =
    story.chapterId != null && book.chapterOrder.includes(story.chapterId as string);
  if (!storyOnAlbum && !storyInChapter) return null;

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
  const book = await getBookBySlug(bookSlug, { publishedOnly: true });
  if (!book) return null;

  const bookIds = [book.id];
  if (book.collabBookId && book.collabBookId !== book.id) {
    bookIds.push(book.collabBookId);
  }

  let storyDoc: Awaited<ReturnType<typeof getDocs>>['docs'][number] | null = null;
  for (const bookId of bookIds) {
    const q = query(
      collection(db, 'storySessions'),
      where('bookId', '==', bookId),
      where('publicSlug', '==', storySlug),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      storyDoc = snap.docs[0];
      break;
    }
  }
  if (!storyDoc) return null;
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
  const newAttachment = stripUndefined({
    ...attachment,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  }) as StoryAttachment;
  await updateDoc(storyRef, stripUndefined({
    attachments: [...existing, newAttachment],
    updatedAt: serverTimestamp(),
  }));
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
  await addStoryAttachment(storyId, stripUndefined({
    type: file.type.startsWith('video/') ? 'video' : 'image',
    url,
    storagePath,
    ...(title?.trim() ? { title: title.trim() } : {}),
  }) as Omit<StoryAttachment, 'id' | 'createdAt'>);
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
