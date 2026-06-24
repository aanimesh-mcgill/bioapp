import { jsPDF } from 'jspdf';
import type { AlbumSpread } from '@/lib/albumPages';
import { qrCodeDataUrl } from '@/lib/qrCode';
import { clipListenUrl } from '@/lib/slug';
import type { AudioClip, Book } from '@/types';

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const QR_SIZE = 22;

function clipsForSpread(page: AlbumSpread, clipsByStory: Record<string, AudioClip[]>): AudioClip[] {
  if (!page.storyId) return [];
  const all = clipsByStory[page.storyId] ?? [];
  if (page.clipIds.length === 0) return all.filter((c) => c.audioUrl);
  const order = new Map(page.clipIds.map((id, i) => [id, i]));
  return all
    .filter((c) => order.has(c.id) && c.audioUrl)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export async function generateBookPdf(
  book: Book,
  pages: AlbumSpread[],
  clipsByStory: Record<string, AudioClip[]>,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const tocSpreads = pages.filter((p) => p.kind === 'spread');
  let pageStarted = false;

  const newSheet = () => {
    if (pageStarted) doc.addPage();
    pageStarted = true;
  };

  for (const page of pages) {
    if (page.kind === 'cover') {
      newSheet();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('AATMA KATHA', PAGE_W / 2, 60, { align: 'center' });
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(book.title, CONTENT_W) as string[];
      doc.text(titleLines, PAGE_W / 2, 90, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'italic');
      doc.text(`by ${book.authorName}`, PAGE_W / 2, 110, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('A life in photos & voices', PAGE_W / 2, 125, { align: 'center' });
      continue;
    }

    if (page.kind === 'toc') {
      newSheet();
      let y = MARGIN;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Contents / विषय सूची', MARGIN, y);
      y += 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      let lastChapter = '';
      for (const spread of tocSpreads) {
        if (spread.chapterTitle && spread.chapterTitle !== lastChapter) {
          lastChapter = spread.chapterTitle;
          y = ensureSpace(doc, y, 8);
          doc.setFont('helvetica', 'bold');
          y = addWrappedText(doc, spread.chapterTitle, MARGIN, y, CONTENT_W, 6);
          doc.setFont('helvetica', 'normal');
        }
        const label = spread.imageTitle ?? spread.bodyText?.slice(0, 60) ?? spread.storyTitle ?? 'Story';
        y = addWrappedText(doc, `• ${label}`, MARGIN + 4, y, CONTENT_W - 4, 5);
      }
      continue;
    }

    if (page.kind === 'chapter') {
      newSheet();
      let y = MARGIN + 40;
      doc.setFontSize(10);
      doc.text('CHAPTER / अध्याय', PAGE_W / 2, y, { align: 'center' });
      y += 15;
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(page.chapterTitle ?? '', PAGE_W / 2, y, { align: 'center' });
      continue;
    }

    if (page.kind === 'spread') {
      newSheet();
      let y = MARGIN;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (page.chapterTitle) {
        y = addWrappedText(doc, page.chapterTitle.toUpperCase(), MARGIN, y, CONTENT_W, 5);
        y += 2;
      }

      if (page.blockType === 'image' && page.imageUrl) {
        const imgData = await fetchImageDataUrl(page.imageUrl);
        if (imgData) {
          const imgW = Math.min(CONTENT_W, 120);
          const imgH = imgW * 1.2;
          y = ensureSpace(doc, y, imgH + 10);
          const imgX = MARGIN + (CONTENT_W - imgW) / 2;
          doc.addImage(imgData, 'JPEG', imgX, y, imgW, imgH);
          y += imgH + 6;
        }
        if (page.imageTitle) {
          doc.setFont('helvetica', 'bold');
          y = addWrappedText(doc, page.imageTitle, MARGIN, y, CONTENT_W, 5);
          doc.setFont('helvetica', 'normal');
        }
        if (page.dateLabel) {
          y = addWrappedText(doc, page.dateLabel, MARGIN, y, CONTENT_W, 5);
        }
        y += 4;
      }

      if (page.blockType === 'text' && page.bodyText) {
        doc.setFont('helvetica', 'italic');
        y = addWrappedText(doc, page.bodyText.split('\n\n')[0]?.slice(0, 400) ?? '', MARGIN, y, CONTENT_W, 5);
        doc.setFont('helvetica', 'normal');
        y += 4;
      }

      if (page.bodyText) {
        const body =
          page.blockType === 'image'
            ? page.bodyText
            : page.bodyText.split('\n\n').slice(1).join('\n\n') || page.bodyText;
        if (body.trim()) {
          y = addWrappedText(doc, body, MARGIN, y, CONTENT_W, 5);
          y += 4;
        }
      }

      const clips = clipsForSpread(page, clipsByStory);
      if (clips.length > 0) {
        y = ensureSpace(doc, y, 12);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Listen — scan QR / सुनें — QR स्कैन करें', MARGIN, y);
        y += 8;
        doc.setFont('helvetica', 'normal');

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const row = Math.floor(i / 3);
          const col = i % 3;
          const qrX = MARGIN + col * (QR_SIZE + 28);
          const qrY = y + row * (QR_SIZE + 14);
          y = ensureSpace(doc, qrY, QR_SIZE + 12);

          const url = clipListenUrl(book.publicSlug, clip.id);
          try {
            const qr = await qrCodeDataUrl(url, 88);
            doc.addImage(qr, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);
            doc.setFontSize(7);
            doc.text(`Clip ${i + 1}`, qrX, qrY + QR_SIZE + 4);
            doc.setFontSize(8);
          } catch {
            doc.text(`Clip ${i + 1}: ${url}`, qrX, qrY);
          }
        }
        const rows = Math.ceil(clips.length / 3);
        y += rows * (QR_SIZE + 14) + 4;
      }
    }
  }

  const safeTitle = book.title.replace(/[^\w\s-]/g, '').trim() || 'album';
  doc.save(`${safeTitle}-aatma-katha.pdf`);
}
