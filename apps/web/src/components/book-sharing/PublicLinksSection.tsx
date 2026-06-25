import { useEffect, useState } from 'react';
import { BilingualBtn, BilingualLine, SectionHeading, T } from '@/components/BilingualText';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { bookPublicUrl } from '@/lib/slug';
import { publishBook, syncPublishedAlbumLinkForBook } from '@/services/books';
import { refreshPublicBookSnapshot } from '@/services/booksCollaboration';
import { ShareButtons } from '@/components/ShareButtons';
import type { AuthorBook, Book } from '@/types';
import { ShareLinkCard } from './ShareLinkCard';

export function PublicLinksSection({
  collabBook,
  albumBook,
  onAlbumBookChange,
}: {
  collabBook: AuthorBook;
  albumBook: Book | null;
  onAlbumBookChange?: (book: Book) => void;
}) {
  const { user } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [busy, setBusy] = useState<'publish' | 'browse' | null>(null);
  const [browseLink, setBrowseLink] = useState('');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (collabBook.activeShareToken) {
      setBrowseLink(`${baseUrl}/browse/${collabBook.activeShareToken}`);
    } else {
      setBrowseLink('');
    }
  }, [collabBook.activeShareToken, baseUrl]);

  useEffect(() => {
    if (albumBook?.isPublished) {
      void syncPublishedAlbumLinkForBook(albumBook.id);
    }
  }, [albumBook?.id, albumBook?.isPublished]);

  const readUrl = albumBook ? bookPublicUrl(albumBook.publicSlug) : '';

  const handlePublishToggle = async () => {
    if (!albumBook) return;
    setBusy('publish');
    try {
      await publishBook(albumBook.id, !albumBook.isPublished);
      onAlbumBookChange?.({ ...albumBook, isPublished: !albumBook.isPublished });
    } finally {
      setBusy(null);
    }
  };

  const handleBrowseLink = async () => {
    if (!user) return;
    setBusy('browse');
    try {
      const token = await refreshPublicBookSnapshot(collabBook.id, user.uid);
      const fullLink = `${baseUrl}/browse/${token}`;
      setBrowseLink(fullLink);
      await navigator.clipboard.writeText(fullLink);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card space-y-4">
      <SectionHeading en="Public links" hi="सार्वजनिक लिंक" />

      <div className="space-y-3 border-b border-slate-100 pb-4">
        <h3 className={`text-sm font-semibold text-slate-800 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          <T en="Published album" hi="प्रकाशित एल्बम" />
        </h3>
        <BilingualLine
          en="Full photo-album view with chapters, stories, and audio QR codes. Requires publishing."
          hi="अध्याय, कहानियाँ और ऑडियो QR के साथ पूरी फोटो-एल्बम। प्रकाशन ज़रूरी।"
          enClass="text-sm text-slate-600"
          hiClass="text-sm text-slate-500"
        />
        {albumBook ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  albumBook.isPublished ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
                disabled={busy === 'publish'}
                onClick={handlePublishToggle}
              >
                <BilingualBtn
                  en={
                    busy === 'publish'
                      ? 'Updating…'
                      : albumBook.isPublished
                        ? 'Published ✓'
                        : 'Publish album'
                  }
                  hi={
                    busy === 'publish'
                      ? 'अपडेट…'
                      : albumBook.isPublished
                        ? 'प्रकाशित ✓'
                        : 'एल्बम प्रकाशित करें'
                  }
                />
              </button>
              {albumBook.isPublished && readUrl && (
                <a
                  href={readUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 underline"
                >
                  <T en="View live album" hi="लाइव एल्बम देखें" />
                </a>
              )}
            </div>
            {albumBook.isPublished && readUrl && (
              <>
                <ShareLinkCard url={readUrl} showQr qrSize={140} />
                <ShareButtons
                  url={readUrl}
                  title={albumBook.title}
                  message={t({
                    en: `Read "${albumBook.title}" on AATMA KATHA`,
                    hi: `AATMA KATHA पर "${albumBook.title}" पढ़ें`,
                  })}
                />
              </>
            )}
          </>
        ) : (
          <p className={`text-sm text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({ en: 'Loading album…', hi: 'एल्बम लोड हो रही…' })}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className={`text-sm font-semibold text-slate-800 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          <T en="Browse snapshot" hi="ब्राउज़ स्नैपशॉट" />
        </h3>
        <BilingualLine
          en="Same live photo-album view as the published link — anyone can open without signing in. Content updates automatically."
          hi="प्रकाशित लिंक जैसा लाइव फोटो-एल्बम — बिना साइन इन के कोई भी खोल सकता है। सामग्री अपने आप अपडेट होती है।"
          enClass="text-sm text-slate-600"
          hiClass="text-sm text-slate-500"
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy === 'browse'}
          onClick={handleBrowseLink}
        >
          <BilingualBtn
            en={
              busy === 'browse'
                ? 'Updating…'
                : browseLink
                  ? 'Update browse link'
                  : 'Create browse link'
            }
            hi={
              busy === 'browse'
                ? 'अपडेट…'
                : browseLink
                  ? 'ब्राउज़ लिंक अपडेट करें'
                  : 'ब्राउज़ लिंक बनाएं'
            }
          />
        </button>
        {browseLink && <ShareLinkCard url={browseLink} />}
      </div>
    </section>
  );
}
