import { randomUUID } from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const db = getFirestore();
const bucket = getStorage().bucket();

async function canAccessAlbum(albumBookId: string, uid: string): Promise<boolean> {
  const albumSnap = await db.collection('books').doc(albumBookId).get();
  if (!albumSnap.exists) return false;
  const album = albumSnap.data()!;
  if (album.userId === uid) return true;

  const collabId = album.collabBookId as string | undefined;
  if (!collabId) return false;

  const collabSnap = await db.collection('collabBooks').doc(collabId).get();
  if (!collabSnap.exists) return false;
  const collab = collabSnap.data()!;
  if (collab.ownerId === uid) return true;
  const collaborators = (collab.collaborators as string[] | undefined) ?? [];
  return collaborators.includes(uid);
}

function sessionIdFromStoragePath(storagePath: string): string | null {
  const match = storagePath.match(/^stories\/[^/]+\/([^/]+)\//);
  return match?.[1] ?? null;
}

async function storyInAlbumChapters(albumBookId: string, sessionId: string): Promise<boolean> {
  const chapters = await db.collection('chapters').where('bookId', '==', albumBookId).get();
  for (const ch of chapters.docs) {
    const storyOrder = (ch.data().storyOrder as string[] | undefined) ?? [];
    if (storyOrder.includes(sessionId)) return true;
  }
  return false;
}

async function canReadStoragePathForPdf(
  albumBookId: string,
  uid: string,
  storagePath: string,
): Promise<boolean> {
  if (!(await canAccessAlbum(albumBookId, uid))) return false;

  if (storagePath.startsWith('collabBooks/') || storagePath.startsWith('album-books/')) {
    return true;
  }

  const sessionId = sessionIdFromStoragePath(storagePath);
  if (!sessionId) return false;
  if (sessionId.startsWith('book-photos-')) return true;

  const albumSnap = await db.collection('books').doc(albumBookId).get();
  const album = albumSnap.data()!;

  const storySnap = await db.collection('storySessions').doc(sessionId).get();
  if (!storySnap.exists) return false;
  const story = storySnap.data()!;

  if (
    story.userId === uid
    || story.bookOwnerId === uid
    || story.bookId === albumBookId
    || story.bookId === album.collabBookId
    || story.collabBookId === album.collabBookId
  ) {
    return true;
  }

  if (album.userId === uid && (await storyInAlbumChapters(albumBookId, sessionId))) {
    return true;
  }

  return false;
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function downloadUrl(bucketName: string, storagePath: string, token: string): string {
  const encoded = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

/** Admin-backed image load for PDF export (bypasses client Storage rules). */
export const resolvePdfImages = onCall(
  { memory: '1GiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }

    const albumBookId = request.data?.albumBookId as string | undefined;
    const paths = (request.data?.storagePaths as string[] | undefined) ?? [];
    if (!albumBookId || paths.length === 0) {
      throw new HttpsError('invalid-argument', 'albumBookId and storagePaths are required');
    }
    if (paths.length > 30) {
      throw new HttpsError('invalid-argument', 'Too many images in one request');
    }

    const uid = request.auth.uid;
    const resolved: Record<string, string> = {};
    const failures: Array<{ storagePath: string; message: string }> = [];

    for (const storagePath of paths) {
      if (!storagePath?.trim()) continue;
      try {
        if (!(await canReadStoragePathForPdf(albumBookId, uid, storagePath))) {
          failures.push({ storagePath, message: 'Not allowed to read this image for PDF export' });
          continue;
        }
        const [buffer] = await bucket.file(storagePath).download();
        const mime = mimeFromPath(storagePath);
        resolved[storagePath] = `data:${mime};base64,${buffer.toString('base64')}`;
      } catch (err) {
        failures.push({
          storagePath,
          message: err instanceof Error ? err.message : 'Download failed',
        });
      }
    }

    return { resolved, failures };
  },
);

/** Admin-backed PDF upload for album books (bypasses client Storage rules). */
export const saveAlbumPdf = onCall(
  { memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }

    const albumBookId = request.data?.albumBookId as string | undefined;
    const pdfBase64 = request.data?.pdfBase64 as string | undefined;
    if (!albumBookId || !pdfBase64) {
      throw new HttpsError('invalid-argument', 'albumBookId and pdfBase64 are required');
    }

    const uid = request.auth.uid;
    if (!(await canAccessAlbum(albumBookId, uid))) {
      throw new HttpsError('permission-denied', 'No access to this album');
    }

    const buffer = Buffer.from(pdfBase64, 'base64');
    if (buffer.length > 100 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'PDF exceeds 100MB limit');
    }

    const storagePath = `album-books/${albumBookId}/saved.pdf`;
    const token = randomUUID();
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      contentType: 'application/pdf',
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const url = downloadUrl(bucket.name, storagePath, token);
    const now = FieldValue.serverTimestamp();

    await db.doc(`books/${albumBookId}/private/pdfDraft`).set(
      {
        savedPdfUrl: url,
        savedPdfStoragePath: storagePath,
        savedPdfAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await db.collection('books').doc(albumBookId).update({
      savedPdfUrl: url,
      savedPdfAt: now,
      updatedAt: now,
    });

    return { url, storagePath };
  },
);
