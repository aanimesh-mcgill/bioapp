import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SpreadClipPlayer } from '@/components/SpreadClipPlayer';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { ShareButtons } from '@/components/ShareButtons';
import { downloadSavedBookPdf } from '@/lib/generateBookPdf';
import type { AlbumSpread } from '@/lib/albumPages';
import { displayChapterTitle } from '@/lib/albumPages';
import type { AudioClip, Book } from '@/types';

interface AlbumBookViewerProps {
  book: Book;
  pages: AlbumSpread[];
  clipsByStory: Record<string, AudioClip[]>;
  mode: 'preview' | 'public';
  backLink?: { to: string; label: string };
  initialPageIndex?: number;
  autoPlayAudiobook?: boolean;
  shareUrl?: string | null;
  shareTitle?: string;
}

function clipsForSpread(page: AlbumSpread, clipsByStory: Record<string, AudioClip[]>): AudioClip[] {
  if (!page.storyId) return [];
  const all = clipsByStory[page.storyId] ?? [];
  if (page.clipIds.length === 0) return all;
  const order = new Map(page.clipIds.map((id, i) => [id, i]));
  return all
    .filter((c) => order.has(c.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .filter((clip, index, list) => list.findIndex((c) => c.id === clip.id) === index);
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
  t,
}: {
  pages: AlbumSpread[];
  pageIndex: number;
  onJump: (idx: number) => void;
  large?: boolean;
  t: (b: { en: string; hi: string }) => string;
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
            {displayChapterTitle(g.title, t)}
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
  autoPlayAudiobook = false,
  shareUrl,
  shareTitle,
}: AlbumBookViewerProps) {
  const t = usePickText();
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [showToc, setShowToc] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [audiobookMode, setAudiobookMode] = useState(autoPlayAudiobook);
  const [pdfLoading, setPdfLoading] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const audiobookModeRef = useRef(audiobookMode);

  useEffect(() => {
    if (autoPlayAudiobook) setAudiobookMode(true);
  }, [autoPlayAudiobook, pageIndex]);

  audiobookModeRef.current = audiobobookMode;

  const current = pages[pageIndex];
  const spreadClips = useMemo(
    () => (current ? clipsForSpread(current, clipsByStory) : []),
    [current, clipsByStory],
  );
  const playableSpreadClips = useMemo(
    () => spreadClips.filter((c) => c.audioUrl),
    [spreadClips],
  );

  const goNext = useCallback(() => setPageIndex((i) => Math.min(i + 1, pages.length - 1)), [pages.length]);
  const goPrev = useCallback(() => setPageIndex((i) => Math.max(i - 1, 0)), []);

  const finishAudiobook = useCallback(() => {
    setAudiobookMode(false);
  }, []);

  const advanceAudiobook = useCallback(() => {
    if (!audiobookModeRef.current) return;
    if (pageIndex >= pages.length - 1) {
      finishAudiobook();
      return;
    }
    goNext();
  }, [pageIndex, pages.length, goNext, finishAudiobook]);

  const handleSpreadClipsComplete = useCallback(() => {
    advanceAudiobook();
  }, [advanceAudiobook]);

  /** Pages without audio auto-turn after a short reading pause. */
  useEffect(() => {
    if (!audiobookMode) return;
    if (playableSpreadClips.length > 0) return;
    if (spreadClips.length > 0) return;
    if (pageIndex >= pages.length - 1) {
      finishAudiobook();
      return;
    }

    const bodyLen = current?.kind === 'spread' ? (current.bodyText?.length ?? 0) : 0;
    const delay =
      bodyLen > 0 ? Math.min(12000, 3500 + bodyLen * 30) : current?.kind === 'spread' ? 3000 : 2500;

    const timer = window.setTimeout(() => {
      if (audiobookModeRef.current) advanceAudiobook();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    audiobookMode,
    pageIndex,
    playableSpreadClips.length,
    current,
    advanceAudiobook,
    finishAudiobook,
    pages.length,
    spreadClips.length,
  ]);

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
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx > 0) goPrev();
    else goNext();
  };

  const handleDownloadPdf = async () => {
    const savedUrl = book.savedPdfUrl;
    if (!savedUrl) return;
    setPdfLoading(true);
    try {
      await downloadSavedBookPdf(book, savedUrl);
    } finally {
      setPdfLoading(false);
    }
  };

  const canDownloadPdf = Boolean(book.savedPdfUrl);

  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < pages.length - 1;

  const hideHeader = () => {
    setShowHeader(false);
    setShowShare(false);
    setShowToc(false);
  };

  return (
    <div className="album-viewer flex min-h-dvh flex-col bg-[#f4ebe0]">
      {showHeader ? (
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
          <div className="relative flex shrink-0 flex-row flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className="rounded-lg bg-white/90 p-1.5 text-amber-900 shadow-sm ring-1 ring-amber-200"
              onClick={hideHeader}
              aria-label={t({ en: 'Hide header', hi: 'हेडर छुपाएं' })}
              title={t({ en: 'Hide header', hi: 'हेडर छुपाएं' })}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 14h16M7 10l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {mode === 'preview' && (
              <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                {t({ en: 'Preview', hi: 'पूर्वावलोकन' })}
              </span>
            )}
            {shareUrl && (
              <button
                type="button"
                className="rounded-lg bg-white/90 p-1.5 text-amber-900 shadow-sm ring-1 ring-amber-200"
                onClick={() => setShowShare((v) => !v)}
                aria-label={t({ en: 'Share', hi: 'साझा करें' })}
                aria-expanded={showShare}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ${
                audiobookMode
                  ? 'bg-brand-600 text-white ring-brand-700'
                  : 'bg-white/90 text-amber-900 ring-amber-200'
              }`}
              onClick={() => setAudiobookMode((on) => !on)}
              aria-pressed={audiobookMode}
              title={t({
                en: audiobookMode ? 'Stop audiobook mode' : 'Play through the book automatically',
                hi: audiobookMode ? 'ऑडियोबुक मोड बंद करें' : 'पुस्तक स्वचालित चलाएं',
              })}
            >
              {audiobookMode ? (
                <BilingualBtn en="Audiobook · On" hi="ऑडियोबुक · चालू" />
              ) : (
                <BilingualBtn en="Audiobook" hi="ऑडियोबुक" />
              )}
            </button>
            <button
              type="button"
              className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200 disabled:opacity-50"
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !canDownloadPdf}
              title={
                canDownloadPdf
                  ? undefined
                  : t({
                      en: 'Save the PDF from book settings before downloading.',
                      hi: 'डाउनलोड से पहले पुस्तक सेटिंग्स से PDF सहेजें।',
                    })
              }
            >
              {pdfLoading ? (
                <BilingualBtn en="Downloading…" hi="डाउनलोड…" />
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
      ) : (
        <button
          type="button"
          className="fixed left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2"
          onClick={() => setShowHeader(true)}
          aria-label={t({ en: 'Show header', hi: 'हेडर दिखाएं' })}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-[#faf6f0]/95 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-md ring-1 ring-amber-200 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 10h16M7 14l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {book.title}
          </span>
          {audiobookMode && (
            <span className="rounded-full bg-brand-600 px-2 py-1 text-[10px] font-bold uppercase text-white shadow-sm">
              {t({ en: 'Playing', hi: 'चल रहा' })}
            </span>
          )}
        </button>
      )}

      {showHeader && showShare && shareUrl && (
        <div className="relative z-20 border-b border-amber-200/60 bg-[#faf6f0]/95 px-4 py-3 shadow-sm">
          <ShareButtons
            compact
            url={shareUrl}
            title={shareTitle ?? book.title}
            message={book.title}
          />
        </div>
      )}

      {showToc && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowToc(false)} aria-hidden />
          <div className="relative z-10 mr-auto h-full w-80 max-w-[85vw] overflow-y-auto bg-[#faf6f0] p-4 shadow-2xl">
            <h2 className="mb-4 font-serif text-lg font-bold text-amber-950">
              {t({ en: 'Contents', hi: 'विषय सूची' })}
            </h2>
            <AlbumTocList pages={pages} pageIndex={pageIndex} onJump={jumpToSpread} t={t} />
          </div>
        </div>
      )}

      <main
        className={`relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-4 sm:px-6 ${showHeader ? '' : 'pt-14'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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

        <div
          className="album-page relative flex min-h-[min(72dvh,680px)] flex-1 flex-col overflow-hidden rounded-sm bg-[#fffef9] shadow-[0_8px_40px_-12px_rgba(120,80,40,0.35),inset_0_0_0_1px_rgba(180,140,90,0.15)]"
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
              <h2 className="mb-6 font-serif text-2xl font-bold text-amber-950">
                {t({ en: 'Contents', hi: 'विषय सूची' })}
              </h2>
              <AlbumTocList pages={pages} pageIndex={pageIndex} onJump={jumpToSpread} large t={t} />
            </div>
          )}

          {current?.kind === 'chapter' && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-700/70">
                {t({ en: 'Chapter', hi: 'अध्याय' })}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-amber-950">
                {displayChapterTitle(current.chapterTitle, t)}
              </h2>
            </div>
          )}

          {current?.kind === 'spread' && (() => {
            const showImage = current.blockType === 'image' && Boolean(current.imageUrl);
            const showBody = Boolean(current.bodyText?.trim());
            const showClips = spreadClips.length > 0;
            const hasContent = showImage || showBody || showClips;

            return (
            <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-4 sm:p-8">
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
                      className="mx-auto max-h-[min(65dvh,520px)] w-full rounded-sm object-contain"
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
                  <SpreadClipPlayer
                    key={pageIndex}
                    clips={spreadClips}
                    autoPlay={audiobookMode}
                    sticky={mode === 'public' && audiobookMode}
                    onQueueComplete={audiobookMode ? handleSpreadClipsComplete : undefined}
                  />
                </div>
              )}

              {!hasContent && (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                  <p className="font-serif text-xl text-amber-950">{current.storyTitle}</p>
                  {current.statusLabel && (
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-700">
                      {current.statusLabel}
                    </p>
                  )}
                  <p className="mt-4 text-sm text-amber-800/60">
                    {t({
                      en: 'Content is still being recorded or transcribed.',
                      hi: 'सामग्री अभी रिकॉर्ड या प्रतिलेखित हो रही है।',
                    })}
                  </p>
                </div>
              )}
            </div>
            );
          })()}
        </div>

        <p className="mt-3 text-center font-serif text-xs text-amber-900/60">
          {pageIndex + 1} / {pages.length}
          {audiobookMode && (
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-brand-700">
              {t({ en: 'Audiobook mode', hi: 'ऑडियोबुक मोड' })}
            </span>
          )}
          <span className="mt-0.5 block text-[10px] text-amber-700/50 sm:hidden">
            {t({ en: 'Swipe left or right to turn page', hi: 'पृष्ठ पलटने के लिए बाएँ या दाएँ स्वाइप करें' })}
          </span>
        </p>
      </main>
    </div>
  );
}
