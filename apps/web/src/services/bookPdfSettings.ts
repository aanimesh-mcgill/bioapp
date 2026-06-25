import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { stripUndefined } from '@/lib/firestoreUtils';
import { logPdfError, PdfOperationError } from '@/lib/pdfErrors';
import { uploadBlobResumable } from '@/lib/storageUpload';
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

export async function saveBookPdf(bookId: string, blob: Blob): Promise<SavedBookPdfMeta> {
  const storagePath = `album-books/${bookId}/saved.pdf`;
  const storageRef = ref(storage, storagePath);
  try {
    await uploadBlobResumable(storageRef, blob, 'application/pdf');
  } catch (err) {
    logPdfError('upload', `Storage upload failed: ${storagePath}`, err);
    throw new PdfOperationError('upload', `Could not upload PDF to ${storagePath}.`, { cause: err });
  }

  let url: string;
  try {
    url = await getDownloadURL(storageRef);
  } catch (err) {
    logPdfError('upload', `getDownloadURL failed: ${storagePath}`, err);
    throw new PdfOperationError('upload', 'PDF uploaded but download URL could not be created.', {
      cause: err,
    });
  }

  const now = serverTimestamp();

  try {
    await setDoc(
      pdfDraftRef(bookId),
      stripUndefined({
        savedPdfUrl: url,
        savedPdfStoragePath: storagePath,
        savedPdfAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );

    await updateDoc(
      doc(db, 'books', bookId),
      stripUndefined({
        savedPdfUrl: url,
        savedPdfAt: now,
        updatedAt: now,
      }),
    );
  } catch (err) {
    logPdfError('metadata', `Firestore save failed for book ${bookId}`, err);
    throw new PdfOperationError('metadata', 'PDF uploaded but metadata could not be saved.', { cause: err });
  }

  return {
    url,
    storagePath,
    generatedAt: new Date(),
    overridesUpdatedAt: null,
  };
}
