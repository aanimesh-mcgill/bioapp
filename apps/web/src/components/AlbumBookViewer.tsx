import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { SpreadClipPlayer } from '@/components/SpreadClipPlayer';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { generateBookPdf } from '@/lib/generateBookPdf';
import { clipListenUrl } from '@/lib/slug';
import type { AlbumSpread } from '@/lib/albumPages';
import type { AudioClip, Book } from '@/types';

interface AlbumBookViewerProps {
  book: Book;
  pages: AlbumSpread[];
  clipsByStory: Record<string, AudioClip[]>;
  mode: 'preview' | 'public';
  backLink?: { to: string; label: string };
  initialPageIndex?: number;
}

function clipsForSpread(page: AlbumSpread, clipsByStory: Record<string, AudioClip[]>): AudioClip[] {
  if (!page.storyId) return [];
  const all = clipsByStory[page.storyId] ?? [];
  if (page.clipIds.length === 0) return all;
  const order = new Map(page.clipIds.map((id, i) => [id, i]));
  return all
    .filter((c) => order.has(c.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

type TocChapterGroup = {
  title: string;
  chapterPageIndex: number;
  spreads: { pageIndex: number; label: string; blockType?: 'image' | 'text' }[];
};

function buildTocGroups(pages: AlbumSpread[]): TocChapterGroup[] {
  const groups: TocChapterGroup[] = [];
  let current: TocChapterGroup | null = null;

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.kind === 'chapter') {
      current = {
        title: p.chapterTitle ?? '',
        chapterPageIndex: i,
        spreads: [],
      };
      groups.push(current);
    } else if (p.kind === 'spread' && current) {
      current.spreads.push({
        pageIndex: i,
        label: p.imageTitle ?? p.bodyText?.slice(0, 50) ?? p.storyTitle ?? 'Story',
        blockType: p.blockType,
      });
    }
  }
  return groups;
}

function AlbumTocList({
  pages,
  pageIndex,
  onJump,
  large,
}: {
  pages: AlbumSpread[];
  pageIndex: number;
  onJump: (idx: number) => void;
  large?: boolean;
}) {
  const groups = buildTocGroups(pages);

  return (
    <ol className="list-decimal space-y-4 pl-5 marker:font-serif marker:font-bold marker:text-amber-950">
      {groups.map((g) => (
        <li key={g.chapterPageIndex}>
          <button
            type="button"
            className={`text-left font-serif font-bold text-amber-950 hover:text-brand-700 ${
              large ? 'text-base sm:text-lg' : 'text-sm'
            } ${pageIndex === g.chapterPageIndex ? 'text-brand-700' : ''}`}
            onClick={() => onJump(g.chapterPageIndex)}
          >
            {g.title}
          </button>
          {g.spreads.length > 0 && (
            <ul className="mt-1 list-none space-y-0 pl-0">
              {g.spreads.map((s) => (
                <li key={s.pageIndex}>
                  <button
                    type="button"
                    className={`block w-full border-b border-amber-100 py-2.5 text-left ${
                      large ? 'font-serif text-sm' : 'text-sm'
                    } ${pageIndex === s.pageIndex ? 'font-semibold text-brand-700' : 'text-amber-950/80'}`}
                    onClick={() => onJump(s.pageIndex)}
                  >
                    {s.blockType === 'image' ? '📷 ' : '📝 '}
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

export function AlbumBookViewer({
  book,
  pages,
  clipsByStory,
  mode,
  backLink,
  initialPageIndex = 0,
}: AlbumBookViewerProps) {
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [showToc, setShowToc] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const current = pages[pageIndex];
  const spreadClips = current ? clipsForSpread(current, clipsByStory) : [];

  const goNext = useCallback(() => setPageIndex((i) => Math.min(i + 1, pages.length - 1)), [pages.length]);
  const goPrev = useCallback(() => setPageIndex((i) => Math.max(i - 1, 0)), []);

  const jumpToSpread = (idx: number) => {
    setPageIndex(idx);
    setShowToc(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showToc || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, showToc]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) goPrev();
    else goNext();
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await generateBookPdf(book, pages, clipsByStory);
    } finally {
      setPdfLoading(false);
    }
  };

  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < pages.length - 1;

  return (
    <div className="album-viewer flex min-h-dvh flex-col bg-[#f4ebe0]">
      <header className="flex items-center justify-between border-b border-amber-200/60 bg-[#faf6f0]/90 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          {backLink && (
            <Link to={backLink.to} className="mb-1 block text-xs text-brand-600">
              {backLink.label}
            </Link>
          )}
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-800/70">AATMA KATHA</p>
          <h1 className="truncate font-serif text-base font-bold text-amber-950">{book.title}</h1>
          <p className="text-xs text-amber-900/60">by {book.authorName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {mode === 'preview' && (
            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
              Preview / पूर्वावलोकन
            </span>
          )}
          <button
            type="button"
            className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200 disabled:opacity-50"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <BilingualBtn en="Building PDF…" hi="PDF बना रहे…" />
            ) : (
              <BilingualBtn en="Download PDF" hi="PDF डाउनलोड" />
            )}
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200"
            onClick={() => setShowToc(!showToc)}
          >
            <BilingualBtn en="Contents" hi="विषय सूची" />
          </button>
        </div>
      </header>

      {showToc && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowToc(false)} aria-hidden />
          <div className="relative z-10 mr-auto h-full w-80 max-w-[85vw] overflow-y-auto bg-[#faf6f0] p-4 shadow-2xl">
            <h2 className="mb-4 font-serif text-lg font-bold text-amber-950">Contents / विषय सूची</h2>
            <AlbumTocList pages={pages} pageIndex={pageIndex} onJump={jumpToSpread} />
          </div>
        </div>
      )}

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-4 sm:px-6">
        {canGoPrev && (
          <button
            type="button"
            className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-xl text-amber-900 shadow-md ring-1 ring-amber-200 hover:bg-white sm:left-2 sm:block"
            onClick={goPrev}
            aria-label="Previous page"
          >
            ‹
          </button>
        )}
        {canGoNext && (
          <button
            type="button"
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-xl text-amber-900 shadow-md ring-1 ring-amber-200 hover:bg-white sm:right-2 sm:block"
            onClick={goNext}
            aria-label="Next page"
          >
            ›
          </button>
        )}

        {canGoPrev && (
          <button
            type="button"
            className="absolute bottom-16 left-0 top-0 z-[5] w-12 cursor-w-resize sm:hidden"
            onClick={goPrev}
            aria-label="Previous page"
          />
        )}
        {canGoNext && (
          <button
            type="button"
            className="absolute bottom-16 right-0 top-0 z-[5] w-12 cursor-e-resize sm:hidden"
            onClick={goNext}
            aria-label="Next page"
          />
        )}

        <div
          className="album-page relative flex min-h-[min(72dvh,680px)] flex-1 flex-col overflow-hidden rounded-sm bg-[#fffef9] shadow-[0_8px_40px_-12px_rgba(120,80,40,0.35),inset_0_0_0_1px_rgba(180,140,90,0.15)] touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {current?.kind === 'cover' && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-800/60">AATMA KATHA</p>
              <div className="my-6 h-px w-16 bg-amber-300/80" />
              <h2 className="font-serif text-3xl font-bold leading-tight text-amber-950 sm:text-4xl">{book.title}</h2>
              <p className="mt-4 font-serif text-lg italic text-amber-900/70">{book.authorName}</p>
              <BilingualLine
                en="A life in photos & voices"
                hi="फोटो और आवाज़ों में एक जीवन"
                enClass="mt-6 text-sm text-amber-800/50"
                hiClass="text-xs text-amber-800/40"
              />
            </div>
          )}

          {current?.kind === 'toc' && (
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <h2 className="mb-6 font-serif text-2xl font-bold text-amber-950">Contents / विषय सूची</h2>
              <AlbumTocList pages={pages} pageIndex={pageIndex} onJump={jumpToSpread} large />
            </div>
          )}

          {current?.kind === 'chapter' && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-700/70">Chapter / अध्याय</p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-amber-950">{current.chapterTitle}</h2>
            </div>
          )}

          {current?.kind === 'spread' && (
            <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-8">
              {current.chapterTitle && (
                <p className="mb-1 text-[10px] uppercase tracking-widest text-amber-700/55">{current.chapterTitle}</p>
              )}
              {current.statusLabel && (
                <span className="mb-2 inline-block self-start rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                  {current.statusLabel}
                </span>
              )}

              {current.contributorName && (
                <p className="mb-3 text-xs text-accent-700">
                  {current.contributorName} · {current.contributorRelationship}
                </p>
              )}

              {current.blockType === 'image' && current.imageUrl && (
                <figure className="mx-auto mb-6 w-full max-w-md">
                  <div className="rounded-sm bg-white p-3 pb-8 shadow-[0_4px_24px_-4px_rgba(80,50,20,0.25)] ring-1 ring-amber-100">
                    <img
                      src={current.imageUrl}
                      alt={current.imageTitle ?? ''}
                      className="aspect-[4/5] w-full rounded-sm object-cover"
                    />
                    {(current.imageTitle || current.dateLabel) && (
                      <figcaption className="mt-3 text-center font-serif text-sm text-amber-950/80">
                        {current.imageTitle}
                        {current.dateLabel && (
                          <span className="mt-0.5 block text-xs text-amber-700/60">{current.dateLabel}</span>
                        )}
                      </figcaption>
                    )}
                  </div>
                </figure>
              )}

              {current.blockType === 'text' && !current.imageUrl && (
                <blockquote className="mb-6 border-l-2 border-amber-400/80 pl-4 font-serif text-lg italic leading-relaxed text-amber-950/90">
                  {current.bodyText?.split('\n\n')[0]?.slice(0, 280)}
                </blockquote>
              )}

              {current.bodyText && (current.blockType === 'image' || current.bodyText.includes('\n')) && (
                <div className="mx-auto max-w-prose flex-1 whitespace-pre-wrap font-serif text-[15px] leading-[1.75] text-amber-950/85">
                  {current.blockType === 'image'
                    ? current.bodyText
                    : current.bodyText.split('\n\n').slice(1).join('\n\n') || current.bodyText}
                </div>
              )}

              {spreadClips.length > 0 && (
                <div className="mt-6 border-t border-amber-200/60 pt-5">
                  <SpreadClipPlayer clips={spreadClips} />

                  <div className="mt-5 flex flex-wrap items-start justify-center gap-6 border-t border-dashed border-amber-200/50 pt-5">
                    <BilingualLine
                      en="Scan to hear on your phone or PC"
                      hi="फोन या PC पर सुनने के लिए स्कैन करें"
                      enClass="w-full text-center text-xs font-semibold text-amber-800/70"
                      hiClass="w-full text-center text-xs text-amber-700/60"
                    />
                    {spreadClips.map((clip, idx) => (
                      <QrCodeDisplay
                        key={clip.id}
                        url={clipListenUrl(book.publicSlug, clip.id)}
                        label={`Clip ${idx + 1} / क्लिप ${idx + 1}`}
                        size={96}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn-secondary min-w-[88px] bg-white/80"
            onClick={goPrev}
            disabled={!canGoPrev}
          >
            ← Prev
          </button>
          <span className="font-serif text-xs text-amber-900/60">
            {pageIndex + 1} / {pages.length}
            <span className="mt-0.5 block text-[10px] text-amber-700/50 sm:hidden">Swipe to turn page / स्वाइप करें</span>
          </span>
          <button
            type="button"
            className="btn-secondary min-w-[88px] bg-white/80"
            onClick={goNext}
            disabled={!canGoNext}
          >
            Next →
          </button>
        </div>
      </main>
    </div>
  );
}
