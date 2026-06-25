import { getBlob, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Extract Firebase Storage object path from a download URL. */
export function storagePathFromFirebaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('firebasestorage.googleapis.com')) return null;
    const encoded = parsed.pathname.split('/o/')[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split('?')[0] ?? encoded);
  } catch {
    return null;
  }
}

async function fetchViaHttp(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

async function fetchViaStorageSdk(url: string): Promise<string | null> {
  const path = storagePathFromFirebaseUrl(url);
  if (!path) return null;
  try {
    const blob = await getBlob(ref(storage, path));
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** Load a remote image as a data URL for canvas/PDF export. */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url || url.startsWith('data:')) return url;
  return (await fetchViaHttp(url)) ?? (await fetchViaStorageSdk(url));
}

export async function resolveImageDataUrls(urls: Iterable<string>): Promise<Map<string, string>> {
  const unique = [...new Set(urls)].filter((url) => url && !url.startsWith('data:'));
  const entries = await Promise.all(
    unique.map(async (url) => {
      const dataUrl = await fetchImageAsDataUrl(url);
      return dataUrl ? ([url, dataUrl] as const) : null;
    }),
  );
  return new Map(entries.filter(Boolean) as [string, string][]);
}
