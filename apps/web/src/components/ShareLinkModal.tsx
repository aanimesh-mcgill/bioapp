import { useState } from 'react';
import { BilingualLine, T } from '@/components/BilingualText';
import { ShareButtons } from '@/components/ShareButtons';
import { Modal } from '@/components/ui/Modal';
import { ShareLinkCard } from '@/components/book-sharing/ShareLinkCard';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';

function ShareIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" strokeLinecap="round" />
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareLinkModal({
  url,
  title,
  message,
  ariaLabel,
  previewHint,
}: {
  url: string | null;
  title: string;
  message?: string;
  ariaLabel: string;
  previewHint?: { en: string; hi: string };
}) {
  const [open, setOpen] = useState(false);
  const t = usePickText();
  const { locale } = useUiLocale();

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-heritage-muted transition hover:bg-heritage-line/60 hover:text-brand-600"
        onClick={handleOpen}
        aria-label={ariaLabel}
      >
        <ShareIcon />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t({ en: 'Share album link', hi: 'एल्बम लिंक साझा करें' })}
      >
        {!url ? (
          <p className={`text-sm text-slate-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({
              en: 'Publish the book from Share & invite to enable sharing.',
              hi: 'साझा करने के लिए शेयर और आमंत्रण से पुस्तक प्रकाशित करें।',
            })}
          </p>
        ) : (
          <div className="space-y-4">
            <BilingualLine
              en={
                previewHint?.en ??
                'Recipients open a photo-album view of this content with audio playback.'
              }
              hi={
                previewHint?.hi ??
                'प्राप्तकर्ता ऑडियो के साथ इस सामग्री का फोटो-एल्बम देख सकते हैं।'
              }
              enClass="text-sm text-slate-600"
              hiClass="text-sm text-slate-500"
            />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-brand-600 underline"
            >
              <T en="Preview album →" hi="एल्बम देखें →" />
            </a>
            <ShareLinkCard url={url} title={title} showQr qrSize={120} />
            <ShareButtons url={url} title={title} message={message ?? title} />
          </div>
        )}
      </Modal>
    </>
  );
}
