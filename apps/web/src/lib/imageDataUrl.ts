import { getBlob, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { describeFirebaseError, logPdfError, type ImageLoadFailure } from '@/lib/pdfErrors';
import { resolvePdfImagesViaFunction } from '@/lib/pdfExportFunctions';

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
    if (!response.ok) {
      logPdfError('images', `HTTP ${response.status} for ${url.slice(0, 120)}`);
      return null;
    }
    return blobToDataUrl(await response.blob());
  } catch (err) {
    logPdfError('images', `HTTP fetch failed for ${url.slice(0, 120)}`, err);
    return null;
  }
}

async function fetchViaStoragePath(
  path: string,
  pageLabel?: string,
): Promise<{ dataUrl: string | null; failure?: ImageLoadFailure }> {
  if (!path?.trim()) return { dataUrl: null };
  try {
    const blob = await getBlob(ref(storage, path));
    return { dataUrl: await blobToDataUrl(blob) };
  } catch (err) {
    const { code, message } = describeFirebaseError(err);
    const failure: ImageLoadFailure = { storagePath: path, pageLabel, code, message };
    logPdfError('images', `Storage SDK getBlob failed: ${path}`, err);
    console.error('[PDF image failure]', failure);
    return { dataUrl: null, failure };
  }
}

async function fetchViaStorageSdk(
  url: string,
  pageLabel?: string,
): Promise<{ dataUrl: string | null; failure?: ImageLoadFailure }> {
  const path = storagePathFromFirebaseUrl(url);
  if (!path) return { dataUrl: null };
  return fetchViaStoragePath(path, pageLabel);
}

/** Load a remote image as a data URL for canvas/PDF export (Storage SDK first). */
export async function fetchImageAsDataUrl(
  url: string,
  storagePath?: string,
  pageLabel?: string,
): Promise<{ dataUrl: string | null; failure?: ImageLoadFailure }> {
  if (!url || url.startsWith('data:')) return { dataUrl: url };
  if (storagePath) {
    const fromPath = await fetchViaStoragePath(storagePath, pageLabel);
    if (fromPath.dataUrl) return fromPath;
    if (url) {
      const viaHttp = await fetchViaHttp(url);
      if (viaHttp) {
        console.info('[PDF image] loaded via HTTP fallback:', pageLabel ?? storagePath);
        return { dataUrl: viaHttp };
      }
    }
    if (fromPath.failure) return { dataUrl: null, failure: fromPath.failure };
  }
  const fromSdk = await fetchViaStorageSdk(url, pageLabel);
  if (fromSdk.dataUrl) return fromSdk;
  if (url && fromSdk.failure) {
    const viaHttp = await fetchViaHttp(url);
    if (viaHttp) {
      console.info('[PDF image] loaded via HTTP fallback:', pageLabel ?? url.slice(0, 80));
      return { dataUrl: viaHttp };
    }
    return { dataUrl: null, failure: fromSdk.failure };
  }
  if (storagePathFromFirebaseUrl(url)) {
    return {
      dataUrl: null,
      failure: fromSdk.failure ?? {
        url,
        pageLabel,
        code: 'image/load-failed',
        message: 'Storage SDK and HTTP fetch both failed.',
      },
    };
  }
  const dataUrl = await fetchViaHttp(url);
  if (dataUrl) return { dataUrl };
  return {
    dataUrl: null,
    failure: {
      url,
      pageLabel,
      code: 'image/load-failed',
      message: 'Could not load image via Storage SDK or HTTP.',
    },
  };
}

export type ImageResolveInput = {
  url?: string;
  storagePath?: string;
  pageLabel?: string;
};

export type ImageResolveResult = {
  resolved: Map<string, string>;
  failures: ImageLoadFailure[];
};

export async function resolveImagesForPdf(
  inputs: ImageResolveInput[],
  opts?: { albumBookId?: string },
): Promise<ImageResolveResult> {
  const resolved = new Map<string, string>();
  const failures: ImageLoadFailure[] = [];
  const seen = new Set<string>();

  const unique = inputs.filter((input) => {
    const dedupeKey = `${input.url ?? ''}|${input.storagePath ?? ''}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return Boolean(input.url || input.storagePath);
  });

  if (opts?.albumBookId && unique.length > 0) {
    const storagePaths = [
      ...new Set(
        unique
          .map((input) => input.storagePath ?? storagePathFromFirebaseUrl(input.url ?? ''))
          .filter((path): path is string => Boolean(path)),
      ),
    ];
    try {
      const { resolved: fromFn, failures: fnFailures } = await resolvePdfImagesViaFunction(
        opts.albumBookId,
        storagePaths,
      );
      for (const input of unique) {
        const path = input.storagePath ?? storagePathFromFirebaseUrl(input.url ?? '');
        const dataUrl = path ? fromFn[path] : undefined;
        if (!dataUrl) continue;
        if (input.url) resolved.set(input.url, dataUrl);
        if (input.storagePath) resolved.set(input.storagePath, dataUrl);
        if (path) resolved.set(path, dataUrl);
      }
      for (const failure of fnFailures) {
        const input = unique.find(
          (item) =>
            item.storagePath === failure.storagePath
            || storagePathFromFirebaseUrl(item.url ?? '') === failure.storagePath,
        );
        failures.push({
          storagePath: failure.storagePath,
          pageLabel: input?.pageLabel,
          code: 'functions/image-failed',
          message: failure.message,
        });
      }
      if (failures.length > 0) {
        console.error('[PDF] image resolve summary (function)', {
          requested: unique.length,
          resolved: resolved.size,
          failures,
        });
      }
      return { resolved, failures };
    } catch (err) {
      logPdfError('images', 'resolvePdfImages function failed', err);
      throw err;
    }
  }

  const settled = await Promise.all(
    unique.map(async (input) => {
      const result = await fetchImageAsDataUrl(input.url ?? '', input.storagePath, input.pageLabel);
      return { input, ...result };
    }),
  );

  for (const { input, dataUrl, failure } of settled) {
    if (failure) failures.push(failure);
    if (!dataUrl) continue;
    if (input.url) resolved.set(input.url, dataUrl);
    if (input.storagePath) resolved.set(input.storagePath, dataUrl);
  }

  if (failures.length > 0) {
    console.error('[PDF] image resolve summary', {
      requested: unique.length,
      resolved: resolved.size,
      failures,
    });
  }

  return { resolved, failures };
}

export async function resolveImageDataUrls(urls: Iterable<string>): Promise<ImageResolveResult> {
  const unique = [...new Set(urls)].filter((url) => url && !url.startsWith('data:'));
  return resolveImagesForPdf(unique.map((url) => ({ url })));
}
