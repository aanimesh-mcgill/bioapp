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
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_BOOK_TITLE } from '@/services/booksCollaboration';
import {
  AUTOBIOGRAPHY_STIMULI,
  PROMPT_TEMPLATES,
  type PromptTemplateId,
} from '@/data/stimuli';
import type { BookPrompt, BookPromptProgress } from '@/types';
import { appendSkippedId, popSkippedId } from '@/lib/turnQueue';
import { effectiveSkippedTurnIds, photoTurnKey, promptTurnKey } from '@/lib/homeTurnQueue';

function toDate(value: unknown): Date {
  return (value as { toDate: () => Date })?.toDate?.() ?? new Date();
}

function mapPrompt(bookId: string, id: string, data: Record<string, unknown>): BookPrompt {
  return {
    id,
    bookId,
    order: (data.order as number) ?? 0,
    titleEn: data.titleEn as string,
    titleHi: (data.titleHi as string) ?? (data.titleEn as string),
    promptEn: data.promptEn as string,
    promptHi: (data.promptHi as string) ?? (data.promptEn as string),
    category: (data.category as string) ?? '',
    categoryHi: (data.categoryHi as string) ?? (data.category as string) ?? '',
    source: (data.source as BookPrompt['source']) ?? 'user',
    systemTemplateId: data.systemTemplateId as string | undefined,
    createdBy: data.createdBy as string | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function promptsCol(bookId: string) {
  return collection(db, 'collabBooks', bookId, 'prompts');
}

function progressDoc(bookId: string, userId: string) {
  return doc(db, 'collabBooks', bookId, 'promptProgress', userId);
}

export function subscribeToBookPrompts(
  bookId: string,
  callback: (prompts: BookPrompt[]) => void,
): () => void {
  const q = query(promptsCol(bookId), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapPrompt(bookId, d.id, d.data())));
    },
    (err) => {
      console.error('book prompts subscription failed:', err);
      callback([]);
    },
  );
}

export function subscribeToPromptProgress(
  bookId: string,
  userId: string,
  callback: (progress: BookPromptProgress) => void,
): () => void {
  return onSnapshot(
    progressDoc(bookId, userId),
    (snap) => {
      if (!snap.exists()) {
        callback({ completedPromptIds: [], skippedPromptIds: [], skippedPhotoIds: [], skippedTurnIds: [], updatedAt: new Date() });
        return;
      }
      const data = snap.data();
      callback({
        completedPromptIds: (data.completedPromptIds as string[]) ?? [],
        skippedPromptIds: (data.skippedPromptIds as string[]) ?? [],
        skippedPhotoIds: (data.skippedPhotoIds as string[]) ?? [],
        skippedTurnIds: (data.skippedTurnIds as string[]) ?? [],
        updatedAt: toDate(data.updatedAt),
      });
    },
    () =>
      callback({
        completedPromptIds: [],
        skippedPromptIds: [],
        skippedPhotoIds: [],
        skippedTurnIds: [],
        updatedAt: new Date(),
      }),
  );
}

async function seedTemplatePrompts(
  bookId: string,
  userId: string,
  templateId: PromptTemplateId,
  existingSystemIds: Set<string>,
): Promise<number> {
  const template = PROMPT_TEMPLATES[templateId];
  const batch = writeBatch(db);
  let added = 0;
  const baseOrder = existingSystemIds.size;

  for (const item of template.prompts) {
    const systemTemplateId = `${templateId}:${item.id}`;
    if (existingSystemIds.has(systemTemplateId)) continue;

    const ref = doc(promptsCol(bookId));
    batch.set(ref, {
      bookId,
      order: baseOrder + item.order,
      titleEn: item.titleEn,
      titleHi: item.titleHi,
      promptEn: item.promptEn,
      promptHi: item.promptHi,
      category: item.category,
      categoryHi: item.categoryHi,
      source: 'system',
      systemTemplateId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    added += 1;
  }

  if (added > 0) await batch.commit();
  return added;
}

/** Seed autobiography prompts for the default Autobiography book when empty. */
export async function ensureDefaultBookPrompts(
  bookId: string,
  bookTitle: string,
  userId: string,
): Promise<void> {
  const snap = await getDocs(query(promptsCol(bookId), orderBy('order', 'asc')));
  if (!snap.empty) return;

  const isAutobiography =
    bookTitle.trim().toLowerCase() === DEFAULT_BOOK_TITLE.toLowerCase();
  if (!isAutobiography) return;

  await seedTemplatePrompts(bookId, userId, 'autobiography', new Set());
}

export async function importPromptTemplate(
  bookId: string,
  userId: string,
  templateId: PromptTemplateId,
): Promise<number> {
  const snap = await getDocs(promptsCol(bookId));
  const existing = new Set(
    snap.docs
      .map((d) => d.data().systemTemplateId as string | undefined)
      .filter(Boolean) as string[],
  );
  const maxOrder = snap.docs.reduce(
    (max, d) => Math.max(max, (d.data().order as number) ?? 0),
    0,
  );

  const template = PROMPT_TEMPLATES[templateId];
  let added = 0;
  const batch = writeBatch(db);

  for (const item of template.prompts) {
    const systemTemplateId = `${templateId}:${item.id}`;
    if (existing.has(systemTemplateId)) continue;

    const ref = doc(promptsCol(bookId));
    batch.set(ref, {
      bookId,
      order: maxOrder + item.order,
      titleEn: item.titleEn,
      titleHi: item.titleHi,
      promptEn: item.promptEn,
      promptHi: item.promptHi,
      category: item.category,
      categoryHi: item.categoryHi,
      source: 'system',
      systemTemplateId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    added += 1;
  }

  if (added > 0) await batch.commit();
  return added;
}

export async function createBookPrompt(
  bookId: string,
  userId: string,
  input: {
    titleEn: string;
    titleHi?: string;
    promptEn: string;
    promptHi?: string;
    category?: string;
    categoryHi?: string;
  },
): Promise<string> {
  const snap = await getDocs(promptsCol(bookId));
  const maxOrder = snap.docs.reduce(
    (max, d) => Math.max(max, (d.data().order as number) ?? 0),
    0,
  );

  const titleHi = input.titleHi?.trim() || input.titleEn.trim();
  const promptHi = input.promptHi?.trim() || input.promptEn.trim();

  const ref = await addDoc(promptsCol(bookId), {
    bookId,
    order: maxOrder + 1,
    titleEn: input.titleEn.trim(),
    titleHi,
    promptEn: input.promptEn.trim(),
    promptHi,
    category: input.category?.trim() ?? '',
    categoryHi: input.categoryHi?.trim() || input.category?.trim() || '',
    source: 'user',
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBookPrompt(
  bookId: string,
  promptId: string,
  input: {
    titleEn: string;
    titleHi?: string;
    promptEn: string;
    promptHi?: string;
    category?: string;
    categoryHi?: string;
  },
): Promise<void> {
  const titleHi = input.titleHi?.trim() || input.titleEn.trim();
  const promptHi = input.promptHi?.trim() || input.promptEn.trim();

  await updateDoc(doc(db, 'collabBooks', bookId, 'prompts', promptId), {
    titleEn: input.titleEn.trim(),
    titleHi,
    promptEn: input.promptEn.trim(),
    promptHi,
    category: input.category?.trim() ?? '',
    categoryHi: input.categoryHi?.trim() || input.category?.trim() || '',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBookPrompt(bookId: string, promptId: string): Promise<void> {
  await deleteDoc(doc(db, 'collabBooks', bookId, 'prompts', promptId));
}

export async function markPromptComplete(
  bookId: string,
  userId: string,
  promptId: string,
): Promise<void> {
  const ref = progressDoc(bookId, userId);
  const snap = await getDoc(ref);
  const completed = snap.exists()
    ? ((snap.data()?.completedPromptIds as string[]) ?? [])
    : [];

  if (completed.includes(promptId)) return;

  const skipped = snap.exists() ? ((snap.data()?.skippedPromptIds as string[]) ?? []) : [];
  const skippedTurn = snap.exists()
    ? effectiveSkippedTurnIds(snap.data() as BookPromptProgress).filter(
        (key) => key !== promptTurnKey(promptId),
      )
    : [];

  await setDoc(
    ref,
    {
      completedPromptIds: [...completed, promptId],
      skippedPromptIds: skipped.filter((id) => id !== promptId),
      skippedTurnIds: skippedTurn,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function appendSkippedTurn(bookId: string, userId: string, turnKey: string): Promise<void> {
  const ref = progressDoc(bookId, userId);
  const snap = await getDoc(ref);
  const skipped = snap.exists() ? effectiveSkippedTurnIds(snap.data() as BookPromptProgress) : [];

  await setDoc(
    ref,
    {
      skippedTurnIds: appendSkippedId(skipped, turnKey),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function skipBookPrompt(
  bookId: string,
  userId: string,
  promptId: string,
): Promise<void> {
  await appendSkippedTurn(bookId, userId, promptTurnKey(promptId));
}

export async function skipBookPhotoInQueue(
  bookId: string,
  userId: string,
  photoId: string,
): Promise<void> {
  await appendSkippedTurn(bookId, userId, photoTurnKey(photoId));
}

/** Go back to the item deferred most recently (reverse of skip). */
export async function previousBookTurn(bookId: string, userId: string): Promise<void> {
  const ref = progressDoc(bookId, userId);
  const snap = await getDoc(ref);
  const skipped = snap.exists() ? effectiveSkippedTurnIds(snap.data() as BookPromptProgress) : [];
  const next = popSkippedId(skipped);
  if (!next) return;

  await setDoc(
    ref,
    {
      skippedTurnIds: next,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** One-time migration hint: map legacy user-level autobiography completions to a book. */
export async function migrateLegacyAutobiographyProgress(
  bookId: string,
  userId: string,
  legacyCompletedIds: string[],
): Promise<void> {
  if (legacyCompletedIds.length === 0) return;

  const snap = await getDocs(promptsCol(bookId));
  const idByTemplate = new Map<string, string>();
  for (const d of snap.docs) {
    const tpl = d.data().systemTemplateId as string | undefined;
    if (tpl?.startsWith('autobiography:')) {
      const legacyId = tpl.slice('autobiography:'.length);
      idByTemplate.set(legacyId, d.id);
    }
  }

  const mapped = legacyCompletedIds
    .map((id) => idByTemplate.get(id))
    .filter(Boolean) as string[];

  if (mapped.length === 0) return;

  const ref = progressDoc(bookId, userId);
  const existing = await getDoc(ref);
  const current = existing.exists()
    ? ((existing.data()?.completedPromptIds as string[]) ?? [])
    : [];
  const merged = [...new Set([...current, ...mapped])];

  await setDoc(ref, { completedPromptIds: merged, updatedAt: serverTimestamp() }, { merge: true });
}

export { AUTOBIOGRAPHY_STIMULI };
