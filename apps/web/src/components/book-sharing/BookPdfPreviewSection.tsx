import { useEffect, useMemo, useState } from 'react';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { buildAlbumPages, filterBlankAlbumPages, indexClipsByStory } from '@/lib/albumPages';
import {
  applyPdfOverrides,
  spreadOverrideKey,
  type PdfOverrides,
  type PdfSpreadOverride,
} from '@/lib/pdfOverrides';
import { buildBookPdfBlob, downloadSavedBookPdf, type PdfBuildProgress } from '@/lib/generateBookPdf';
import { formatPdfErrorForUi, logPdfError, PdfOperationError } from '@/lib/pdfErrors';
import { getBookPreviewData, ensureStoriesLinkedForPdfExport } from '@/services/books';
import {
  isSavedPdfStale,
  saveBookPdf,
  savePdfOverrides,
  subscribeToPdfDraft,
  type SavedBookPdfMeta,
} from '@/services/bookPdfSettings';
import type { AlbumSpread } from '@/lib/albumPages';
import type { AudioClip, Book, Chapter, StorySession } from '@/types';

function spreadLabel(page: AlbumSpread): string {
  if (page.imageTitle) return page.imageTitle;
  if (page.storyTitle) return page.storyTitle;
  const snippet = page.bodyText?.trim().slice(0, 48);
  return snippet ? `${snippet}…` : 'Story page';
}

export function BookPdfPreviewSection({
  albumBook,
  collabBookId,
}: {
  albumBook: Book;
  collabBookId?: string;
}) {
  const { user } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stories, setStories] = useState<StorySession[]>([]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [overrides, setOverrides] = useState<PdfOverrides>({});
  const [savedPdf, setSavedPdf] = useState<SavedBookPdfMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [pdfProgress, setPdfProgress] = useState('');

  useEffect(() => {
    if (!user || !albumBook.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getBookPreviewData(albumBook.id, user.uid)
      .then((data) => {
        if (!data) return;
        setChapters(data.chapters);
        setStories(data.stories);
        setClips(data.clips);
      })
      .finally(() => setLoading(false));
  }, [user, albumBook.id]);

  useEffect(() => {
    if (!albumBook.id) return;
    return subscribeToPdfDraft(albumBook.id, (draft) => {
      setOverrides(draft.overrides);
      setSavedPdf(draft.savedPdf);
    });
  }, [albumBook.id]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const clipsByStory = useMemo(() => indexClipsByStory(clips), [clips]);

  const basePages = useMemo(
    () => buildAlbumPages(albumBook, chapters, stories, clipsByStory, { preview: true }),
    [albumBook, chapters, stories, clipsByStory],
  );

  const pdfPages = useMemo(
    () => filterBlankAlbumPages(applyPdfOverrides(basePages, overrides), clipsByStory),
    [basePages, overrides, clipsByStory],
  );

  const spreadPages = useMemo(
    () =>
      basePages
        .map((page, index) => ({ page, index, key: spreadOverrideKey(page) }))
        .filter((entry): entry is { page: AlbumSpread; index: number; key: string } => !!entry.key),
    [basePages],
  );

  const pdfStale = isSavedPdfStale(savedPdf);

  useEffect(() => {
    if (spreadPages.length === 0) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) =>
      prev && spreadPages.some((entry) => entry.key === prev) ? prev : spreadPages[0].key,
    );
  }, [spreadPages]);

  const patchOverride = (key: string, patch: Partial<PdfSpreadOverride>) => {
    setOverrides((prev) => {
      const merged = { ...prev[key], ...patch };
      if (patch.excluded === false) delete merged.excluded;
      const next = { ...prev };
      if (Object.keys(merged).length === 0) delete next[key];
      else next[key] = merged;
      return next;
    });
  };

  const cleanedOverrides = () =>
    Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value && Object.keys(value).length > 0),
    );

  const handleSave = async () => {
    if (!albumBook.id) return;
    setSaving(true);
    setActionError('');
    try {
      await savePdfOverrides(albumBook.id, cleanedOverrides());
    } catch (err) {
      console.error(err);
      setActionError(t({ en: 'Could not save edits.', hi: 'संपादन सहेजे नहीं जा सके।' }));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePdf = async () => {
    if (!albumBook.id) return;
    setSavingPdf(true);
    setActionError('');
    setPdfProgress('');
    try {
      await savePdfOverrides(albumBook.id, cleanedOverrides());
      setPdfProgress('Preparing stories…');
      await ensureStoriesLinkedForPdfExport(albumBook, stories);
      setPdfProgress('Building PDF…');
      const blob = await buildBookPdfBlob(albumBook, pdfPages, clipsByStory, (p: PdfBuildProgress) => {
        if (p.stage === 'images') setPdfProgress(p.detail ?? 'Loading images…');
        else if (p.stage === 'render' && p.current != null && p.total != null) {
          setPdfProgress(`Rendering page ${p.current}/${p.total}…`);
        }
      });
      setPdfProgress('Uploading PDF…');
      const meta = await saveBookPdf(albumBook.id, blob, {
        collabBookId: collabBookId ?? albumBook.collabBookId,
      });
      setSavedPdf(meta);
      if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(meta.url);
      setPdfProgress('');
    } catch (err) {
      const stage = err instanceof PdfOperationError ? err.stage : 'upload';
      logPdfError(stage, 'Save PDF failed', err);
      setActionError(formatPdfErrorForUi(err));
      setPdfProgress('');
    } finally {
      setSavingPdf(false);
    }
  };

  const handlePreviewPdf = async () => {
    setPdfLoading(true);
    setActionError('');
    setPdfProgress('');
    try {
      if (savedPdf?.url && !pdfStale) {
        if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(savedPdf.url);
        return;
      }
      if (albumBook.id) {
        await savePdfOverrides(albumBook.id, cleanedOverrides());
      }
      setPdfProgress('Preparing stories…');
      await ensureStoriesLinkedForPdfExport(albumBook, stories);
      setPdfProgress('Building preview…');
      const blob = await buildBookPdfBlob(albumBook, pdfPages, clipsByStory, (p: PdfBuildProgress) => {
        if (p.stage === 'images') setPdfProgress(p.detail ?? 'Loading images…');
        else if (p.stage === 'render' && p.current != null && p.total != null) {
          setPdfProgress(`Rendering page ${p.current}/${p.total}…`);
        }
      });
      const nextUrl = URL.createObjectURL(blob);
      if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(nextUrl);
      setPdfProgress('');
    } catch (err) {
      logPdfError('render', 'Preview PDF failed', err);
      setActionError(formatPdfErrorForUi(err));
      setPdfProgress('');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    const url = savedPdf?.url ?? albumBook.savedPdfUrl;
    if (!url) {
      setActionError(
        t({
          en: 'Save the PDF first. Downloads use your saved file instead of generating a new one each time.',
          hi: 'पहले PDF सहेजें। डाउनलोड हर बार नई PDF बनाने के बजाय आपकी सहेजी फ़ाइल का उपयोग करते हैं।',
        }),
      );
      return;
    }
    setPdfLoading(true);
    setActionError('');
    try {
      await downloadSavedBookPdf(albumBook, url);
    } catch (err) {
      logPdfError('download', 'Download PDF failed', err);
      setActionError(formatPdfErrorForUi(err));
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (spreadPages.length === 0) {
    return (
      <div className="card">
        <BilingualLine
          en="Add stories to your book before preparing a PDF."
          hi="PDF तैयार करने से पहले अपनी पुस्तक में कहानियाँ जोड़ें।"
          enClass="text-sm text-slate-500"
          hiClass="text-sm text-slate-400"
        />
      </div>
    );
  }

  const selected = spreadPages.find((entry) => entry.key === selectedKey) ?? spreadPages[0];
  const selectedOverride = overrides[selected.key] ?? {};
  const displayBody = selectedOverride.bodyText ?? selected.page.bodyText ?? '';
  const displayTitle = selectedOverride.imageTitle ?? selected.page.imageTitle ?? '';
  const displayDate = selectedOverride.dateLabel ?? selected.page.dateLabel ?? '';
  const isExcluded = Boolean(selectedOverride.excluded);
  const hasSavedPdf = Boolean(savedPdf?.url ?? albumBook.savedPdfUrl);

  return (
    <section className="card space-y-4">
      <div>
        <h2 className={`text-base font-semibold text-heritage-ink ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({ en: 'PDF preview & edit', hi: 'PDF पूर्वावलोकन और संपादन' })}
        </h2>
        <BilingualLine
          en="Edit page text, then save the PDF once. Everyone downloads that saved file."
          hi="पृष्ठ पाठ संपादित करें, फिर PDF एक बार सहेजें। सभी वही सहेजी फ़ाइल डाउनलोड करेंगे।"
          enClass="mt-1 text-sm text-heritage-muted"
          hiClass="text-sm text-heritage-muted"
        />
      </div>

      {hasSavedPdf && (
        <p className={`text-xs ${pdfStale ? 'text-amber-700' : 'text-emerald-700'} ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {pdfStale
            ? t({
                en: 'Edits changed since the last saved PDF. Save PDF again to update downloads.',
                hi: 'पिछली सहेजी PDF के बाद संपादन बदले हैं। डाउनलोड अपडेट करने के लिए PDF फिर सहेजें।',
              })
            : t({
                en: 'A saved PDF is ready for download.',
                hi: 'सहेजी PDF डाउनलोड के लिए तैयार है।',
              })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {spreadPages.map((entry) => {
          const excluded = Boolean(overrides[entry.key]?.excluded);
          const active = entry.key === selected.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setSelectedKey(entry.key)}
              className={`rounded-lg px-3 py-1.5 text-left text-xs ${
                active
                  ? 'bg-brand-600 text-white'
                  : excluded
                    ? 'bg-slate-100 text-slate-400 line-through ring-1 ring-slate-200'
                    : 'bg-heritage-paper text-heritage-ink ring-1 ring-heritage-line'
              }`}
            >
              {entry.page.blockType === 'image' ? '📷 ' : '📝 '}
              {spreadLabel(entry.page)}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border border-heritage-line bg-heritage-paper/50 p-4">
        <p className="text-sm font-medium text-heritage-ink">{spreadLabel(selected.page)}</p>

        {selected.page.blockType === 'image' && (
          <>
            <label className="block text-xs font-semibold uppercase tracking-wide text-heritage-muted">
              {t({ en: 'Photo caption', hi: 'फोटो शीर्षक' })}
            </label>
            <input
              className="input-field"
              value={displayTitle}
              onChange={(e) => patchOverride(selected.key, { imageTitle: e.target.value })}
            />
            <label className="block text-xs font-semibold uppercase tracking-wide text-heritage-muted">
              {t({ en: 'Date', hi: 'तारीख' })}
            </label>
            <input
              className="input-field"
              value={displayDate}
              onChange={(e) => patchOverride(selected.key, { dateLabel: e.target.value })}
            />
          </>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-heritage-muted">
          {t({ en: 'Page text', hi: 'पृष्ठ पाठ' })}
        </label>
        <textarea
          className="input-field min-h-[120px] resize-y"
          value={displayBody}
          onChange={(e) => patchOverride(selected.key, { bodyText: e.target.value })}
        />

        <label className="flex items-center gap-2 text-sm text-heritage-muted">
          <input
            type="checkbox"
            checked={isExcluded}
            onChange={(e) => patchOverride(selected.key, { excluded: e.target.checked })}
          />
          {t({ en: 'Exclude this page from PDF', hi: 'इस पृष्ठ को PDF से हटाएं' })}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={saving || savingPdf}
          onClick={handleSave}
        >
          {saving ? t({ en: 'Saving…', hi: 'सहेज रहे हैं…' }) : t({ en: 'Save edits', hi: 'संपादन सहेजें' })}
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={savingPdf || pdfLoading || pdfPages.length === 0}
          onClick={handleSavePdf}
        >
          {savingPdf
            ? t({ en: 'Saving PDF…', hi: 'PDF सहेज रहे हैं…' })
            : t({ en: 'Save PDF', hi: 'PDF सहेजें' })}
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          disabled={pdfLoading || savingPdf || pdfPages.length === 0}
          onClick={handlePreviewPdf}
        >
          {pdfLoading ? t({ en: 'Loading…', hi: 'लोड हो रहा है…' }) : t({ en: 'Preview PDF', hi: 'PDF देखें' })}
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          disabled={pdfLoading || savingPdf || !hasSavedPdf}
          onClick={handleDownloadPdf}
        >
          <BilingualBtn en="Download PDF" hi="PDF डाउनलोड" />
        </button>
      </div>

      {pdfProgress && (
        <p className="text-sm text-amber-800">{pdfProgress}</p>
      )}

      {actionError && (
        <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionError}
        </pre>
      )}

      {!albumBook.isPublished && (
        <p className={`text-xs text-amber-700 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({
            en: 'Publish your album so QR codes in the PDF link to the online book.',
            hi: 'PDF में QR कोड ऑनलाइन पुस्तक से जोड़ने के लिए एल्बम प्रकाशित करें।',
          })}
        </p>
      )}

      {pdfPreviewUrl && (
        <iframe
          title="Album PDF preview"
          src={pdfPreviewUrl}
          className="h-[480px] w-full rounded-xl border border-heritage-line"
        />
      )}
    </section>
  );
}
