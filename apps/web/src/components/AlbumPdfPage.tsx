import { useEffect, useRef } from 'react';
import type { AlbumSpread } from '@/lib/albumPages';
import { displayChapterTitle } from '@/lib/albumPages';
import type { AudioClip, Book } from '@/types';

export const PDF_PAGE_W = 794;
export const PDF_PAGE_H = 1123;

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function textFontClass(text: string): string {
  return hasDevanagari(text) ? 'font-hindi' : 'font-serif';
}

type TocGroup = {
  title: string;
  spreads: { label: string; blockType?: 'image' | 'text' }[];
};

function buildTocGroups(pages: AlbumSpread[]): TocGroup[] {
  const groups: TocGroup[] = [];
  let current: TocGroup | null = null;

  for (const p of pages) {
    if (p.kind === 'chapter') {
      current = { title: p.chapterTitle ?? '', spreads: [] };
      groups.push(current);
    } else if (p.kind === 'spread' && current) {
      current.spreads.push({
        label: p.imageTitle ?? p.bodyText?.slice(0, 50) ?? p.storyTitle ?? 'Story',
        blockType: p.blockType,
      });
    }
  }
  return groups;
}

export interface AlbumPdfPageProps {
  book: Book;
  page: AlbumSpread;
  pages: AlbumSpread[];
  clips: AudioClip[];
  qrDataUrl?: string | null;
  onReady?: () => void;
}

export function AlbumPdfPage({ book, page, pages, clips, qrDataUrl, onReady }: AlbumPdfPageProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const imgs = el.querySelectorAll('img');
    const waits = [...imgs].map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.onload = done;
        img.onerror = done;
      });
    });
    void Promise.all(waits).then(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      onReady?.();
    });
  }, [onReady, page, qrDataUrl, clips.length]);

  const shell = (children: React.ReactNode) => (
    <div
      ref={ref}
      style={{ width: PDF_PAGE_W, height: PDF_PAGE_H }}
      className="box-border flex bg-[#f4ebe0] p-10"
    >
      <div className="flex min-h-0 w-full max-w-[680px] flex-1 flex-col rounded-sm bg-[#fffef9] shadow-[0_8px_40px_-12px_rgba(120,80,40,0.35),inset_0_0_0_1px_rgba(180,140,90,0.15)]">
        {children}
      </div>
    </div>
  );

  if (page.kind === 'cover') {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-800/60">AATMA KATHA</p>
        <div className="my-6 h-px w-16 bg-amber-300/80" />
        <h2 className={`text-4xl font-bold leading-tight text-amber-950 ${textFontClass(book.title)}`}>
          {book.title}
        </h2>
        <p className="mt-4 font-serif text-lg italic text-amber-900/70">by {book.authorName}</p>
        <p className="mt-6 font-hindi text-sm text-amber-800/50">A life in photos & voices</p>
        <p className="mt-1 font-hindi text-xs text-amber-800/40">फोटो और आवाज़ों में एक जीवन</p>
      </div>,
    );
  }

  if (page.kind === 'toc') {
    const groups = buildTocGroups(pages);
    return shell(
      <div className="flex-1 overflow-hidden p-10">
        <h2 className="mb-6 font-serif text-2xl font-bold text-amber-950">Contents / विषय सूची</h2>
        <ol className="list-decimal space-y-4 pl-5 marker:font-serif marker:font-bold marker:text-amber-950">
          {groups.map((g) => (
            <li key={g.title}>
              <p className="font-serif text-base font-bold text-amber-950">
                {displayChapterTitle(g.title, (b) => (b.hi ? b.hi : b.en))}
              </p>
              {g.spreads.length > 0 && (
                <ul className="mt-1 list-none space-y-0 pl-0">
                  {g.spreads.map((s) => (
                    <li
                      key={s.label}
                      className={`border-b border-amber-100 py-2.5 font-serif text-sm text-amber-950/80 ${textFontClass(s.label)}`}
                    >
                      {s.blockType === 'image' ? '📷 ' : '📝 '}
                      {s.label}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>,
    );
  }

  if (page.kind === 'chapter') {
    const title = displayChapterTitle(page.chapterTitle, (b) => (b.hi ? b.hi : b.en));
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700/70">Chapter / अध्याय</p>
        <h2 className={`mt-3 text-3xl font-bold text-amber-950 ${textFontClass(title)}`}>{title}</h2>
      </div>,
    );
  }

  if (page.kind === 'spread') {
    const body =
      page.blockType === 'image'
        ? page.bodyText
        : page.bodyText?.split('\n\n').slice(1).join('\n\n') || page.bodyText;
    const lead =
      page.blockType === 'text' && page.bodyText
        ? page.bodyText.split('\n\n')[0]?.slice(0, 280)
        : '';
    const bodyClass = textFontClass(page.bodyText ?? lead ?? '');
    const hindiBody = hasDevanagari(body ?? lead ?? '');
    const hasQr = clips.length > 0 && Boolean(qrDataUrl);
    const bodyLineHeight = hindiBody ? 1.95 : 1.75;

    return shell(
      <div className="flex min-h-0 flex-1 flex-col p-8">
        <div className="min-h-0 flex-1">
          {page.chapterTitle && (
            <p className="mb-1 text-[10px] uppercase tracking-widest text-amber-700/55">{page.chapterTitle}</p>
          )}

          {page.blockType === 'image' && page.imageUrl && (
            <figure className={`mx-auto w-full ${hasQr ? 'mb-3 max-w-[240px]' : 'mb-5 max-w-md'}`}>
              <div className="rounded-sm bg-white p-3 pb-4 shadow-[0_4px_24px_-4px_rgba(80,50,20,0.25)] ring-1 ring-amber-100">
                <img
                  src={page.imageUrl}
                  alt={page.imageTitle ?? ''}
                  crossOrigin={page.imageUrl.startsWith('data:') ? undefined : 'anonymous'}
                  className={
                    hasQr
                      ? 'mx-auto max-h-[150px] w-full rounded-sm object-contain'
                      : 'mx-auto max-h-[300px] w-full rounded-sm object-contain'
                  }
                />
                {(page.imageTitle || page.dateLabel) && (
                  <figcaption className="mt-2 text-center font-serif text-sm text-amber-950/80">
                    {page.imageTitle}
                    {page.dateLabel && (
                      <span className="mt-0.5 block text-xs text-amber-700/60">{page.dateLabel}</span>
                    )}
                  </figcaption>
                )}
              </div>
            </figure>
          )}

          {page.blockType === 'text' && lead && (
            <blockquote
              className={`mb-4 border-l-2 border-amber-400/80 pl-4 text-lg italic leading-relaxed text-amber-950/90 ${bodyClass}`}
            >
              {lead}
            </blockquote>
          )}

          {body?.trim() && (page.blockType === 'image' || page.bodyText?.includes('\n')) && (
            <div
              className={`mx-auto max-w-prose whitespace-pre-wrap text-amber-950/85 ${bodyClass} ${
                hasQr
                  ? page.blockType === 'image'
                    ? 'text-[12px]'
                    : 'text-[13px]'
                  : 'text-[15px]'
              }`}
              style={{ lineHeight: bodyLineHeight }}
            >
              {body}
            </div>
          )}
        </div>

        {hasQr && (
          <div className="mt-4 shrink-0 border-t border-amber-200/60 pt-4">
            <p className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-800/70">
              Listen to this memory
            </p>
            <p className="mb-3 text-center font-hindi text-[10px] text-amber-700/60">इस याद को सुनें</p>
            <div className="flex flex-col items-center">
              <img src={qrDataUrl!} width={104} height={104} alt="Scan to listen" className="rounded-lg" />
              <p className="mt-2 text-center text-[10px] text-amber-800/70">
                Scan to hear {clips.length} {clips.length === 1 ? 'clip' : 'clips'} on your phone or PC
              </p>
              <p className="mt-0.5 text-center font-hindi text-[10px] text-amber-700/60">
                फोन या PC पर सुनने के लिए स्कैन करें
              </p>
              {clips.length > 1 && (
                <p className="mt-1 text-center text-[9px] text-amber-700/60">
                  Clips play in order automatically
                </p>
              )}
            </div>
          </div>
        )}
      </div>,
    );
  }

  return shell(null);
}
