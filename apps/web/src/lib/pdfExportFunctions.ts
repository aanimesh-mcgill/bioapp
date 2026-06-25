import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

type ResolvePdfImagesRequest = {
  albumBookId: string;
  storagePaths: string[];
};

type ResolvePdfImagesResponse = {
  resolved: Record<string, string>;
  failures: Array<{ storagePath: string; message: string }>;
};

type SaveAlbumPdfRequest = {
  albumBookId: string;
  pdfBase64: string;
};

type SaveAlbumPdfResponse = {
  url: string;
  storagePath: string;
};

export async function resolvePdfImagesViaFunction(
  albumBookId: string,
  storagePaths: string[],
): Promise<ResolvePdfImagesResponse> {
  const callable = httpsCallable<ResolvePdfImagesRequest, ResolvePdfImagesResponse>(
    functions,
    'resolvePdfImages',
  );
  const result = await callable({ albumBookId, storagePaths });
  return result.data;
}

export async function saveAlbumPdfViaFunction(
  albumBookId: string,
  blob: Blob,
): Promise<SaveAlbumPdfResponse> {
  const pdfBase64 = await blobToBase64(blob);
  const callable = httpsCallable<SaveAlbumPdfRequest, SaveAlbumPdfResponse>(
    functions,
    'saveAlbumPdf',
  );
  const result = await callable({ albumBookId, pdfBase64 });
  return result.data;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
