import { getDownloadURL, ref, uploadBytesResumable, type StorageReference } from 'firebase/storage';

/** Guess image MIME when the browser leaves File.type empty (common on mobile gallery picks). */
export function resolveImageContentType(file: File): string {
  if (file.type?.startsWith('image/')) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  if (name.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

export function uploadBlobResumable(
  storageRef: StorageReference,
  data: Blob,
  contentType: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, data, { contentType });
    task.on(
      'state_changed',
      undefined,
      (err) => reject(err),
      () => resolve(),
    );
  });
}

export async function uploadFileAndGetUrl(
  storageRef: StorageReference,
  file: File,
  contentType?: string,
): Promise<string> {
  const type = contentType ?? resolveImageContentType(file);
  await uploadBlobResumable(storageRef, file, type);
  return getDownloadURL(storageRef);
}

function isHeicFile(file: File, type: string): boolean {
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

/** Normalize gallery picks (HEIC, missing MIME) into a browser-friendly JPEG when needed. */
export async function preparePhotoFileForUpload(file: File): Promise<File> {
  const type = resolveImageContentType(file);
  const normalized =
    file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });

  if (!isHeicFile(normalized, type)) {
    return normalized;
  }

  try {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: normalized, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob as Blob], file.name.replace(/\.[^.]+$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return normalized;
  }
}
