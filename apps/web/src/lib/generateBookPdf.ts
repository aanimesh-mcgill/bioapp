import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AlbumPdfPage, PDF_PAGE_H, PDF_PAGE_W } from '@/components/AlbumPdfPage';
import type { AlbumSpread } from '@/lib/albumPages';
import { filterBlankAlbumPages } from '@/lib/albumPages';
import { resolveImagesForPdf } from '@/lib/imageDataUrl';
import { qrCodeDataUrl } from '@/lib/qrCode';
import { spreadPublicUrl } from '@/lib/slug';
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

function renderPageToDom(
  container: HTMLElement,
  props: {
    book: Book;
    page: AlbumSpread;
    pages: AlbumSpread[];
    clips: AudioClip[];
    qrDataUrl?: string | null;
  },
): Promise<ReturnType<typeof createRoot>> {
  return new Promise((resolve) => {
    const root = createRoot(container);
    root.render(
      createElement(AlbumPdfPage, {
        ...props,
        onReady: () => resolve(root),
      }),
    );
  });
}

function pageWithResolvedImage(page: AlbumSpread, resolved: Map<string, string>): AlbumSpread {
  if (page.kind !== 'spread' || page.blockType !== 'image') return page;
  const dataUrl =
    (page.imageUrl ? resolved.get(page.imageUrl) : undefined) ??
    (page.imageStoragePath ? resolved.get(page.imageStoragePath) : undefined);
  if (!dataUrl) return page;
  return { ...page, imageUrl: dataUrl };
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
    .map((p) => ({ url: p.imageUrl, storagePath: p.imageStoragePath }));
  const resolvedImages = await resolveImagesForPdf(imageInputs);

  try {
    let pageStarted = false;

    for (let pageIndex = 0; pageIndex < printablePages.length; pageIndex++) {
      const page = pageWithResolvedImage(printablePages[pageIndex], resolvedImages);
      const clips = page.kind === 'spread' ? clipsForSpread(page, clipsByStory) : [];
      let qrDataUrl: string | null = null;

      if (clips.length > 0 && page.storyId) {
        const spreadPageIndex = printablePages.findIndex(
          (p) =>
            p.kind === 'spread' &&
            p.storyId === page.storyId &&
            (page.blockId ? p.blockId === page.blockId : true),
        );
        const url = spreadPublicUrl(
          book.publicSlug,
          {
            storyId: page.storyId,
            blockId: page.blockId,
            pageIndex: spreadPageIndex >= 0 ? spreadPageIndex : pageIndex,
          },
          { play: true },
        );
        qrDataUrl = await qrCodeDataUrl(url, 200);
      }

      mount.innerHTML = '';
      const root = await renderPageToDom(mount, { book, page, pages: printablePages, clips, qrDataUrl });
      const imageData = await capturePage(mount);
      root.unmount();

      if (pageStarted) doc.addPage();
      pageStarted = true;
      doc.addImage(imageData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
    }
  } finally {
    mount.remove();
  }

  return doc;
}

export async function buildBookPdfBlob(
  book: Book,
  pages: AlbumSpread[],
  clipsByStory: Record<string, AudioClip[]>,
): Promise<Blob> {
  const doc = await renderBookPdfDoc(book, pages, clipsByStory);
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
