import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  createChapter,
  getOrCreateAlbumBookForCollab,
  linkStoryToCollabAlbum,
} from '@/services/books';
import {
  createStorySession,
  type CreateSessionOpts,
} from '@/services/storySessions';
import type { Chapter, StorySession } from '@/types';

export interface CollabBookRef {
  id: string;
  title: string;
}

/** Resolve the published album + first chapter for a collab book. */
export async function ensureDefaultChapterForCollab(
  userId: string,
  collabBook: CollabBookRef,
  authorName: string,
): Promise<{ albumBookId: string; chapterId: string }> {
  const album = await getOrCreateAlbumBookForCollab(userId, collabBook, authorName);

  const chaptersSnap = await getDocs(
    query(
      collection(db, 'chapters'),
      where('bookId', '==', album.id),
      where('userId', '==', userId),
    ),
  );

  if (!chaptersSnap.empty) {
    const sorted = chaptersSnap.docs
      .map((d) => ({ id: d.id, order: (d.data().order as number) ?? 0 }))
      .sort((a, b) => a.order - b.order);
    return { albumBookId: album.id, chapterId: sorted[0].id };
  }

  const chapterId = await createChapter(album.id, userId, 'Chapter 1');
  return { albumBookId: album.id, chapterId };
}

/** Create a story session linked to the collab book — unassigned until the user picks a chapter. */
export async function createStoryInBook(
  opts: CreateSessionOpts,
  collabBook: CollabBookRef | null | undefined,
  authorName: string,
): Promise<string> {
  const collabBookId = collabBook?.id ?? opts.bookId;
  const sessionId = await createStorySession({
    ...opts,
    bookId: collabBookId ?? undefined,
    collabBookId: collabBookId ?? undefined,
  });

  if (collabBook && collabBookId) {
    const { albumBookId } = await ensureDefaultChapterForCollab(
      opts.userId,
      collabBook,
      authorName,
    );
    await linkStoryToCollabAlbum(sessionId, albumBookId, collabBookId);
  }

  return sessionId;
}

/** Link an existing story to the active collab book without assigning a chapter. */
export async function assignExistingStoryToCollabBook(
  storyId: string,
  userId: string,
  collabBook: CollabBookRef,
  authorName: string,
): Promise<void> {
  const { albumBookId } = await ensureDefaultChapterForCollab(userId, collabBook, authorName);
  await linkStoryToCollabAlbum(storyId, albumBookId, collabBook.id);
}

export async function createChapterForCollabBook(
  userId: string,
  collabBook: CollabBookRef,
  authorName: string,
  title: string,
): Promise<string> {
  const { albumBookId } = await ensureDefaultChapterForCollab(userId, collabBook, authorName);
  const albumSnap = await getDoc(doc(db, 'books', albumBookId));
  const chapterOrder = (albumSnap.data()?.chapterOrder as string[]) ?? [];
  return createChapter(albumBookId, userId, title.trim() || `Chapter ${chapterOrder.length + 1}`);
}

/** Stories belonging to this collab book (also matches linked album book id). */
export function storyBelongsToCollabBook(
  story: { bookId?: string | null; collabBookId?: string | null },
  collabBookId: string,
  albumBookId?: string | null,
): boolean {
  if (story.collabBookId === collabBookId) return true;
  if (!story.bookId) return false;
  if (story.bookId === collabBookId) return true;
  if (albumBookId && story.bookId === albumBookId) return true;
  return false;
}

export function chapterStoryIdSet(chapters: Chapter[]): Set<string> {
  return new Set(chapters.flatMap((ch) => ch.storyOrder));
}

/** Match book stories by ids on the session or by chapter storyOrder (fallback). */
export function collectBookStories(
  sessions: StorySession[],
  collabBookId: string,
  albumBookId: string | null | undefined,
  chapters: Chapter[],
): StorySession[] {
  const chapterIds = chapterStoryIdSet(chapters);
  const byId = new Map<string, StorySession>();
  for (const s of sessions) {
    if (storyBelongsToCollabBook(s, collabBookId, albumBookId) || chapterIds.has(s.id)) {
      byId.set(s.id, s);
    }
  }
  return Array.from(byId.values());
}
