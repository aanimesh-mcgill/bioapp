import { jsPDF } from 'jspdf';

export interface PhotobookStoryInput {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorName: string;
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawStoryText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 16) {
  const lines = doc.splitTextToSize(text, maxWidth);
  let currentY = y;
  lines.forEach((line: string) => {
    if (currentY > 800) {
      doc.addPage();
      currentY = 72;
    }
    doc.text(line, x, currentY);
    currentY += lineHeight;
  });
  return currentY;
}

export async function buildPhotobookPdf(params: {
  bookTitle: string;
  stories: PhotobookStoryInput[];
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  doc.setFillColor(250, 248, 240);
  doc.rect(0, 0, 595, 842, 'F');
  doc.setTextColor(25, 37, 64);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(params.bookTitle, 72, 140);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(71, 85, 105);
  doc.text('A collaborative photobook generated from Autobio', 72, 172);

  for (const story of params.stories) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 595, 842, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(17, 24, 39);
    doc.text(story.title, 72, 72);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`by ${story.authorName}`, 72, 92);

    let cursorY = 120;
    if (story.imageUrl) {
      const imageDataUrl = await loadImageDataUrl(story.imageUrl);
      if (imageDataUrl) {
        const maxWidth = 451;
        const maxHeight = 260;
        const props = doc.getImageProperties(imageDataUrl);
        const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);
        const drawWidth = props.width * ratio;
        const drawHeight = props.height * ratio;
        const x = 72 + (maxWidth - drawWidth) / 2;
        doc.addImage(imageDataUrl, props.fileType || 'JPEG', x, cursorY, drawWidth, drawHeight, undefined, 'FAST');
        cursorY += drawHeight + 22;
      }
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(12.5);
    doc.setTextColor(30, 41, 59);
    drawStoryText(doc, story.content, 72, cursorY, 451);
  }

  return doc.output('blob');
}
