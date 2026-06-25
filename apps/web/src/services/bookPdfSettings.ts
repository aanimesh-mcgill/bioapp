import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { stripUndefined } from '@/lib/firestoreUtils';
import type { PdfOverrides } from '@/lib/pdfOverrides';

function pdfDraftRef(bookId: string) {
  return doc(db, 'books', bookId, 'private', 'pdfDraft');
}

export function subscribeToPdfOverrides(
  bookId: string,
  callback: (overrides: PdfOverrides) => void,
): () => void {
  return onSnapshot(
    pdfDraftRef(bookId),
    (snap) => {
      const data = snap.data();
      callback((data?.spreads as PdfOverrides) ?? {});
    },
    (err) => {
      console.error('pdf overrides subscription failed:', err);
      callback({});
    },
  );
}

export async function savePdfOverrides(bookId: string, overrides: PdfOverrides): Promise<void> {
  await setDoc(
    pdfDraftRef(bookId),
    stripUndefined({
      spreads: overrides,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
}
