import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AlbumPdfPage, PDF_PAGE_H, PDF_PAGE_W } from '@/components/AlbumPdfPage';
import type { AlbumSpread } from '@/lib/albumPages';
import { filterBlankAlbumPages } from '@/lib/albumPages';
import { resolveImagesForPdf } from '@/lib/imageDataUrl';
import { logPdfError, PdfOperationError } from '@/lib/pdfErrors';
import { qrCodeDataUrl } from '@/lib/qrCode';
import { spreadListenUrl } from '@/lib/slug';
import type { AudioClip, Book } from '@/types';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;

function clipsForSpread(page: AlbumSpread, clipsByStory: Record<string, AudioClip[]>): AudioClip[] {
  if (!page.storyId) return [];
  const all = clipsByStory[page.storyId] ?? [];
  if (page.clipIds.length === 0) return all.filter((c) => c.audioUrl);
  const order = new Map(page.clipIds.map((id, i) => [id, i]));
  return all
    .filter((c) => order.has(c.id) && c.audioUrl)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export type PdfBuildProgress = {
  stage: 'images' | 'render' | 'done';
  current?: number;
  total?: number;
  detail?: string;
};

function spreadLabel(page: AlbumSpread): string {
  return page.imageTitle ?? page.storyTitle ?? page.bodyText?.trim().slice(0, 40) ?? 'Page';
}

function renderPageToDom(
  container: HTMLElement,
  props: {
    book: Book;
    page: AlbumSpread;
    pages: AlbumSpread[];
    clips: AudioClip[];
    qrDataUrl?: string | null;
  },
  pageIndex: number,
): Promise<ReturnType<typeof createRoot>> {
  return new Promise((resolve, reject) => {
    const root = createRoot(container);
    let settled = false;
    const label = spreadLabel(props.page);
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(root);
    };
    const timer = window.setTimeout(() => {
      const err = new PdfOperationError(
        'render',
        `Timed out rendering page ${pageIndex + 1} (${label}) after 15s.`,
        { code: 'pdf/render-timeout', pageIndex, pageLabel: label },
      );
      logPdfError('render', err.message, err);
      reject(err);
    }, 15_000);
    root.render(
      createElement(AlbumPdfPage, {
        ...props,
        onReady: () => {
          window.clearTimeout(timer);
          finish();
        },
      }),
    );
  });
}

function pageWithResolvedImage(page: AlbumSpread, resolved: Map<string, string>): AlbumSpread {
  if (page.kind !== 'spread' || page.blockType !== 'image') return page;
  const dataUrl =
    (page.imageUrl ? resolved.get(page.imageUrl) : undefined) ??
    (page.imageStoragePath ? resolved.get(page.imageStoragePath) : undefined);
  if (!dataUrl) return { ...page, imageUrl: undefined, imageStoragePath: undefined };
  return { ...page, imageUrl: dataUrl, imageStoragePath: undefined };
}

async function capturePage(container: HTMLElement): Promise<string> {
  await document.fonts.ready;
  try {
    await Promise.all([
      document.fonts.load('400 16px "Noto Sans Devanagari"'),
      document.fonts.load('400 16px "Cormorant Garamond"'),
    ]);
  } catch {
    // Font loading is best-effort before canvas capture.
  }
  const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#f4ebe0',
    logging: false,
    width: PDF_PAGE_W,
    height: PDF_PAGE_H,
    windowWidth: PDF_PAGE_W,
    windowHeight: PDF_PAGE_H,
  });
  return canvas.toDataURL('image/jpeg', 0.92);
}

async function renderBookPdfDoc(
  book: Book,
  pages: AlbumSpread[],
  clipsByStory: Record<string, AudioClip[]>,
  onProgress?: (progress: PdfBuildProgress) => void,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const printablePages = filterBlankAlbumPages(pages, clipsByStory);
  const mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '-10000px';
  mount.style.top = '0';
  mount.style.width = `${PDF_PAGE_W}px`;
  mount.style.height = `${PDF_PAGE_H}px`;
  mount.style.overflow = 'hidden';
  document.body.appendChild(mount);

  const imageInputs = printablePages
    .filter(
      (p): p is AlbumSpread & { blockType: 'image' } =>
        p.kind === 'spread' && p.blockType === 'image' && Boolean(p.imageUrl || p.imageStoragePath),
    )
    .map((p) => ({
      url: p.imageUrl,
      storagePath: p.imageStoragePath,
      pageLabel: spreadLabel(p),
    }));

  onProgress?.({ stage: 'images', detail: `Loading ${imageInputs.length} images…` });
  const { resolved: resolvedImages, failures: imageFailures } = await resolveImagesForPdf(
    imageInputs,
    { albumBookId: book.id },
  );

  if (imageFailures.length > 0) {
    throw new PdfOperationError(
      'images',
      `${imageFailures.length} of ${imageInputs.length} images could not be loaded (check Storage permissions).`,
      { code: 'pdf/images-failed', failures: imageFailures },
    );
  }

  try {
    let pageStarted = false;

    for (let pageIndex = 0; pageIndex < printablePages.length; pageIndex++) {
      const page = pageWithResolvedImage(printablePages[pageIndex], resolvedImages);
      const label = spreadLabel(page);
      onProgress?.({
        stage: 'render',
        current: pageIndex + 1,
        total: printablePages.length,
        detail: `Rendering ${label}…`,
      });

      const clips = page.kind === 'spread' ? clipsForSpread(page, clipsByStory) : [];
      let qrDataUrl: string | null = null;

      if (clips.length > 0 && page.storyId) {
        const spreadPageIndex = printablePages.findIndex(
          (p) =>
            p.kind === 'spread' &&
            p.storyId === page.storyId &&
            (page.blockId ? p.blockId === page.blockId : true),
        );
        const url = spreadListenUrl(
          book.id,
          {
            storyId: page.storyId,
            blockId: page.blockId,
            pageIndex: spreadPageIndex >= 0 ? spreadPageIndex : pageIndex,
          },
          { play: true },
        );
        try {
          qrDataUrl = await qrCodeDataUrl(url, 200);
        } catch (err) {
          logPdfError('render', `QR code failed for page ${pageIndex + 1}`, err);
        }
      }

      mount.innerHTML = '';
      try {
        const root = await renderPageToDom(
          mount,
          { book, page, pages: printablePages, clips, qrDataUrl },
          pageIndex,
        );
        const imageData = await capturePage(mount);
        root.unmount();

        if (pageStarted) doc.addPage();
        pageStarted = true;
        doc.addImage(imageData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
      } catch (err) {
        throw err instanceof PdfOperationError
          ? err
          : new PdfOperationError('render', `Failed on page ${pageIndex + 1} (${label}).`, {
              cause: err,
              pageIndex,
              pageLabel: label,
            });
      }
    }
  } finally {
    mount.remove();
  }

  onProgress?.({ stage: 'done', detail: 'PDF built' });
  return doc;
}

export async function buildBookPdfBlob(
  book: Book,
  pages: AlbumSpread[],
  clipsByStory: Record<string, AudioClip[]>,
  onProgress?: (progress: PdfBuildProgress) => void,
): Promise<Blob> {
  const doc = await renderBookPdfDoc(book, pages, clipsByStory, onProgress);
  return doc.output('blob');
}

export async function generateBookPdf(
  book: Book,
  pages: AlbumSpread[],
  clipsByStory: Record<string, AudioClip[]>,
): Promise<void> {
  const doc = await renderBookPdfDoc(book, pages, clipsByStory);
  const safeTitle = book.title.replace(/[^\w\s-]/g, '').trim() || 'album';
  doc.save(`${safeTitle}-aatma-katha.pdf`);
}

export function downloadBookPdfBlob(book: Book, blob: Blob): void {
  const safeTitle = book.title.replace(/[^\w\s-]/g, '').trim() || 'album';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle}-aatma-katha.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSavedBookPdf(book: Book, pdfUrl: string): Promise<void> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error('Failed to fetch saved PDF');
    downloadBookPdfBlob(book, await response.blob());
  } catch {
    const safeTitle = book.title.replace(/[^\w\s-]/g, '').trim() || 'album';
    const anchor = document.createElement('a');
    anchor.href = pdfUrl;
    anchor.download = `${safeTitle}-aatma-katha.pdf`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}
