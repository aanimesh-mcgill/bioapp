import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type {
  AuthorBook,
  BookAudioClip,
  BookInvitation,
  BookStory,
  BookStoryStatus,
  PromptType,
  PublicBookSnapshot,
} from '@/types';

function randomToken(length = 22) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i += 1) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function toDate(value: unknown): Date {
  return (value as { toDate: () => Date })?.toDate?.() ?? new Date();
}

function mapBook(snap: QueryDocumentSnapshot<DocumentData>): AuthorBook {
  const data = snap.data();
  return {
    id: snap.id,
    ownerId: data.ownerId as string,
    title: data.title as string,
    description: data.description as string | undefined,
    activeShareToken: data.activeShareToken as string | undefined,
    collaborators: (data.collaborators as string[] | undefined) ?? [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapInvitation(snap: QueryDocumentSnapshot<DocumentData>): BookInvitation {
  const data = snap.data();
  return {
    id: snap.id,
    token: data.token as string,
    bookId: data.bookId as string,
    bookTitle: data.bookTitle as string,
    inviterId: data.inviterId as string,
    inviterName: data.inviterName as string,
    inviteeEmail: data.inviteeEmail as string,
    inviteeUid: data.inviteeUid as string | undefined,
    status: data.status as BookInvitation['status'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    acceptedAt: data.acceptedAt ? toDate(data.acceptedAt) : undefined,
  };
}

function mapStory(snap: QueryDocumentSnapshot<DocumentData>): BookStory {
  const data = snap.data();
  return {
    id: snap.id,
    bookId: data.bookId as string,
    title: data.title as string,
    content: data.content as string,
    imageUrl: data.imageUrl as string | undefined,
    status: data.status as BookStory['status'],
    authorId: data.authorId as string,
    authorName: data.authorName as string,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapAudioClip(snap: QueryDocumentSnapshot<DocumentData>): BookAudioClip {
  const data = snap.data();
  return {
    id: snap.id,
    bookId: data.bookId as string,
    promptType: data.promptType as PromptType,
    promptText: data.promptText as string,
    imageUrl: data.imageUrl as string | undefined,
    audioUrl: data.audioUrl as string,
    storagePath: data.storagePath as string,
    createdBy: data.createdBy as string,
    createdByName: data.createdByName as string,
    createdAt: toDate(data.createdAt),
  };
}

export async function createBook(ownerId: string, title: string, description = ''): Promise<string> {
  const bookRef = await addDoc(collection(db, 'books'), {
    ownerId,
    title,
    description,
    collaborators: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return bookRef.id;
}

export async function ensureUserHasBook(userId: string): Promise<string> {
  const ownerBooks = await getDocs(query(collection(db, 'books'), where('ownerId', '==', userId)));
  if (!ownerBooks.empty) return ownerBooks.docs[0].id;

  const invitedBooks = await getDocs(
    query(collection(db, 'books'), where('collaborators', 'array-contains', userId)),
  );
  if (!invitedBooks.empty) return invitedBooks.docs[0].id;

  return createBook(userId, 'My First Book', 'Start collecting your life stories.');
}

export function subscribeToBooks(userId: string, callback: (books: AuthorBook[]) => void) {
  const ownerQ = query(
    collection(db, 'books'),
    where('ownerId', '==', userId),
    orderBy('updatedAt', 'desc'),
  );
  const collaboratorQ = query(
    collection(db, 'books'),
    where('collaborators', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  );

  let ownerBooks: AuthorBook[] = [];
  let collaboratorBooks: AuthorBook[] = [];

  const publish = () => {
    const merged = new Map<string, AuthorBook>();
    ownerBooks.forEach((book) => merged.set(book.id, book));
    collaboratorBooks.forEach((book) => merged.set(book.id, book));
    callback(
      Array.from(merged.values()).sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      ),
    );
  };

  const unsubOwner = onSnapshot(ownerQ, (snap) => {
    ownerBooks = snap.docs.map(mapBook);
    publish();
  });
  const unsubCollaborator = onSnapshot(collaboratorQ, (snap) => {
    collaboratorBooks = snap.docs.map(mapBook);
    publish();
  });

  return () => {
    unsubOwner();
    unsubCollaborator();
  };
}

export async function getBook(bookId: string): Promise<AuthorBook | null> {
  const snap = await getDoc(doc(db, 'books', bookId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ownerId: data.ownerId as string,
    title: data.title as string,
    description: data.description as string | undefined,
    activeShareToken: data.activeShareToken as string | undefined,
    collaborators: (data.collaborators as string[] | undefined) ?? [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function createBookInvitation(params: {
  book: AuthorBook;
  inviterId: string;
  inviterName: string;
  inviteeEmail: string;
}) {
  const token = randomToken();
  const inviteeEmail = params.inviteeEmail.trim().toLowerCase();
  await setDoc(doc(db, 'bookInvitations', token), {
    token,
    bookId: params.book.id,
    bookTitle: params.book.title,
    inviterId: params.inviterId,
    inviterName: params.inviterName,
    inviteeEmail,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return token;
}

export function subscribeToInvitations(
  userId: string,
  email: string | null | undefined,
  callback: (invitations: BookInvitation[]) => void,
) {
  const lowerEmail = (email ?? '').toLowerCase();
  const byUserQ = query(
    collection(db, 'bookInvitations'),
    where('inviteeUid', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const byEmailQ = lowerEmail
    ? query(
        collection(db, 'bookInvitations'),
        where('inviteeEmail', '==', lowerEmail),
        orderBy('createdAt', 'desc'),
      )
    : null;

  let userInvites: BookInvitation[] = [];
  let emailInvites: BookInvitation[] = [];

  const publish = () => {
    const merged = new Map<string, BookInvitation>();
    userInvites.forEach((invite) => merged.set(invite.id, invite));
    emailInvites.forEach((invite) => merged.set(invite.id, invite));
    callback(
      Array.from(merged.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    );
  };

  const unsubByUser = onSnapshot(byUserQ, (snap) => {
    userInvites = snap.docs.map(mapInvitation);
    publish();
  });

  const unsubByEmail = byEmailQ
    ? onSnapshot(byEmailQ, (snap) => {
        emailInvites = snap.docs.map(mapInvitation);
        publish();
      })
    : () => undefined;

  return () => {
    unsubByUser();
    unsubByEmail();
  };
}

export async function getInvitationByToken(token: string): Promise<BookInvitation | null> {
  const snap = await getDoc(doc(db, 'bookInvitations', token));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    token: data.token as string,
    bookId: data.bookId as string,
    bookTitle: data.bookTitle as string,
    inviterId: data.inviterId as string,
    inviterName: data.inviterName as string,
    inviteeEmail: data.inviteeEmail as string,
    inviteeUid: data.inviteeUid as string | undefined,
    status: data.status as BookInvitation['status'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    acceptedAt: data.acceptedAt ? toDate(data.acceptedAt) : undefined,
  };
}

export async function acceptInvitation(token: string, params: { userId: string; email: string }) {
  const inviteRef = doc(db, 'bookInvitations', token);

  await runTransaction(db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invitation not found.');
    const invite = inviteSnap.data();

    if (invite.status !== 'pending') {
      if (invite.inviteeUid !== params.userId) {
        throw new Error('Invitation is no longer available.');
      }
      return;
    }

    const inviteEmail = String(invite.inviteeEmail ?? '').toLowerCase();
    if (inviteEmail && inviteEmail !== params.email.toLowerCase()) {
      throw new Error('This invitation is for another email account.');
    }

    tx.update(inviteRef, {
      status: 'accepted',
      inviteeUid: params.userId,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const bookRef = doc(db, 'books', invite.bookId as string);
    tx.update(bookRef, {
      collaborators: arrayUnion(params.userId),
      updatedAt: serverTimestamp(),
    });
  });

  const refreshed = await getInvitationByToken(token);
  if (!refreshed) throw new Error('Invitation disappeared.');
  return refreshed;
}

export function subscribeToBookStories(bookId: string, callback: (stories: BookStory[]) => void) {
  const q = query(
    collection(db, 'bookStories'),
    where('bookId', '==', bookId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map(mapStory)));
}

export async function createBookStory(params: {
  bookId: string;
  title: string;
  content: string;
  imageUrl?: string;
  status?: BookStoryStatus;
  authorId: string;
  authorName: string;
}) {
  await addDoc(collection(db, 'bookStories'), {
    bookId: params.bookId,
    title: params.title.trim(),
    content: params.content.trim(),
    imageUrl: params.imageUrl?.trim() ?? '',
    status: params.status ?? 'draft',
    authorId: params.authorId,
    authorName: params.authorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateBookStory(
  storyId: string,
  patch: Partial<Pick<BookStory, 'title' | 'content' | 'imageUrl' | 'status'>>,
) {
  await updateDoc(doc(db, 'bookStories', storyId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToBookAudioClips(bookId: string, callback: (clips: BookAudioClip[]) => void) {
  const q = query(
    collection(db, 'bookAudioClips'),
    where('bookId', '==', bookId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map(mapAudioClip)));
}

export async function uploadBookAudioClip(
  params: {
    bookId: string;
    file: File | Blob;
    promptType: PromptType;
    promptText: string;
    imageUrl?: string;
    createdBy: string;
    createdByName: string;
  },
  onProgress?: (pct: number) => void,
) {
  const clipRef = await addDoc(collection(db, 'bookAudioClips'), {
    bookId: params.bookId,
    promptType: params.promptType,
    promptText: params.promptText.trim(),
    imageUrl: params.imageUrl?.trim() ?? '',
    audioUrl: '',
    storagePath: '',
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    createdAt: serverTimestamp(),
  });

  const storagePath = `book-audio/${params.bookId}/${clipRef.id}/clip.webm`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, params.file, {
    contentType: params.file.type || 'audio/webm',
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100);
      },
      reject,
      resolve,
    );
  });

  const audioUrl = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'bookAudioClips', clipRef.id), {
    storagePath,
    audioUrl,
  });
}

export async function refreshPublicBookSnapshot(bookId: string, requesterUid: string) {
  const book = await getBook(bookId);
  if (!book) throw new Error('Book not found');
  if (book.ownerId !== requesterUid) {
    throw new Error('Only the book owner can create a public share link.');
  }

  const storiesSnap = await getDocs(
    query(collection(db, 'bookStories'), where('bookId', '==', bookId), orderBy('createdAt', 'asc')),
  );
  const clipsSnap = await getDocs(
    query(collection(db, 'bookAudioClips'), where('bookId', '==', bookId), orderBy('createdAt', 'asc')),
  );

  const shareToken = book.activeShareToken || randomToken(18);
  const payload: Omit<PublicBookSnapshot, 'id'> = {
    bookId,
    bookTitle: book.title,
    description: book.description,
    shareToken,
    stories: storiesSnap.docs.map((docSnap) => {
      const story = mapStory(docSnap);
      return {
        id: story.id,
        title: story.title,
        content: story.content,
        imageUrl: story.imageUrl,
        authorName: story.authorName,
        createdAt: story.createdAt.toISOString(),
      };
    }),
    audioClips: clipsSnap.docs.map((docSnap) => {
      const clip = mapAudioClip(docSnap);
      return {
        id: clip.id,
        promptType: clip.promptType,
        promptText: clip.promptText,
        imageUrl: clip.imageUrl,
        audioUrl: clip.audioUrl,
        createdByName: clip.createdByName,
        createdAt: clip.createdAt.toISOString(),
      };
    }),
    updatedAt: new Date(),
  };

  await setDoc(doc(db, 'publicBooks', shareToken), {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'books', bookId), {
    activeShareToken: shareToken,
    updatedAt: serverTimestamp(),
  });

  return shareToken;
}

export async function getPublicBookByToken(token: string): Promise<PublicBookSnapshot | null> {
  const snap = await getDoc(doc(db, 'publicBooks', token));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    bookId: data.bookId as string,
    bookTitle: data.bookTitle as string,
    description: data.description as string | undefined,
    shareToken: data.shareToken as string,
    stories: (data.stories as PublicBookSnapshot['stories']) ?? [],
    audioClips: (data.audioClips as PublicBookSnapshot['audioClips']) ?? [],
    updatedAt: toDate(data.updatedAt),
  };
}
