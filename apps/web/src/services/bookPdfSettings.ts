import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { stripUndefined } from '@/lib/firestoreUtils';
import { logPdfError, PdfOperationError } from '@/lib/pdfErrors';
import { saveAlbumPdfViaFunction } from '@/lib/pdfExportFunctions';
import type { PdfOverrides } from '@/lib/pdfOverrides';

export type SavedBookPdfMeta = {
  url: string;
  storagePath: string;
  generatedAt: Date | null;
  overridesUpdatedAt: Date | null;
};

export type PdfDraftState = {
  overrides: PdfOverrides;
  savedPdf: SavedBookPdfMeta | null;
};

function pdfDraftRef(bookId: string) {
  return doc(db, 'books', bookId, 'private', 'pdfDraft');
}

function mapSavedPdfMeta(data: Record<string, unknown> | undefined): SavedBookPdfMeta | null {
  const url = data?.savedPdfUrl as string | undefined;
  if (!url) return null;
  return {
    url,
    storagePath: (data?.savedPdfStoragePath as string) ?? '',
    generatedAt: (data?.savedPdfAt as { toDate: () => Date })?.toDate?.() ?? null,
    overridesUpdatedAt:
      (data?.overridesUpdatedAt as { toDate: () => Date })?.toDate?.() ?? null,
  };
}

function mapPdfDraft(data: Record<string, unknown> | undefined): PdfDraftState {
  return {
    overrides: (data?.spreads as PdfOverrides) ?? {},
    savedPdf: mapSavedPdfMeta(data),
  };
}

export function subscribeToPdfOverrides(
  bookId: string,
  callback: (overrides: PdfOverrides) => void,
): () => void {
  return onSnapshot(
    pdfDraftRef(bookId),
    (snap) => {
      callback((snap.data()?.spreads as PdfOverrides) ?? {});
    },
    (err) => {
      console.error('pdf overrides subscription failed:', err);
      callback({});
    },
  );
}

export function subscribeToPdfDraft(
  bookId: string,
  callback: (draft: PdfDraftState) => void,
): () => void {
  return onSnapshot(
    pdfDraftRef(bookId),
    (snap) => callback(mapPdfDraft(snap.data())),
    (err) => {
      console.error('pdf draft subscription failed:', err);
      callback({ overrides: {}, savedPdf: null });
    },
  );
}

export function isSavedPdfStale(savedPdf: SavedBookPdfMeta | null): boolean {
  if (!savedPdf?.generatedAt || !savedPdf.overridesUpdatedAt) return false;
  return savedPdf.overridesUpdatedAt.getTime() > savedPdf.generatedAt.getTime();
}

export async function savePdfOverrides(bookId: string, overrides: PdfOverrides): Promise<void> {
  await setDoc(
    pdfDraftRef(bookId),
    stripUndefined({
      spreads: overrides,
      overridesUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
}

/** Ensure album book has collabBookId so Storage rules can authorize PDF upload. */
export async function ensureAlbumBookStorageAccess(
  albumBookId: string,
  collabBookId?: string,
): Promise<void> {
  if (!collabBookId) return;
  const bookRef = doc(db, 'books', albumBookId);
  const snap = await getDoc(bookRef);
  if (!snap.exists()) return;
  if (snap.data()?.collabBookId === collabBookId) return;
  await updateDoc(bookRef, {
    collabBookId,
    updatedAt: serverTimestamp(),
  });
  console.info('[PDF] linked album book to collab for storage access:', albumBookId, collabBookId);
}

export async function saveBookPdf(
  bookId: string,
  blob: Blob,
  opts?: { collabBookId?: string },
): Promise<SavedBookPdfMeta> {
  if (opts?.collabBookId) {
    await ensureAlbumBookStorageAccess(bookId, opts.collabBookId);
  }

  try {
    const { url, storagePath } = await saveAlbumPdfViaFunction(bookId, blob);
    return {
      url,
      storagePath,
      generatedAt: new Date(),
      overridesUpdatedAt: null,
    };
  } catch (err) {
    logPdfError('upload', `saveAlbumPdf function failed for ${bookId}`, err);
    throw new PdfOperationError('upload', `Could not upload PDF to album-books/${bookId}/saved.pdf.`, {
      cause: err,
    });
  }
}
