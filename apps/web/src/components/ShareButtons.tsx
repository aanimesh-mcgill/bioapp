import { useState } from 'react';
import { T } from '@/components/BilingualText';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import {
  emailShareUrl,
  facebookShareUrl,
  linkedInShareUrl,
  openShareWindow,
  twitterShareUrl,
  whatsAppShareUrl,
} from '@/lib/share';

type ShareButtonsProps = {
  url: string | null;
  title: string;
  /** Short line included in tweet / WhatsApp message */
  message?: string;
  compact?: boolean;
  className?: string;
};

export function ShareButtons({ url, title, message, compact, className = '' }: ShareButtonsProps) {
  const t = usePickText();
  const { locale } = useUiLocale();
  const [copied, setCopied] = useState(false);
  const shareMessage = message ?? title;
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  if (!url) {
    return (
      <p className={`text-xs text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''} ${className}`}>
        {t({
          en: 'Publish the book to share on social media.',
          hi: 'सोशल मीडिया पर साझा करने के लिए पुस्तक प्रकाशित करें।',
        })}
      </p>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: shareMessage, url });
    } catch {
      /* user cancelled */
    }
  };

  const btnClass = compact
    ? 'rounded-lg px-2.5 py-1.5 text-xs font-semibold'
    : 'rounded-xl px-3 py-2 text-sm font-semibold';

  return (
    <div className={className}>
      {!compact && (
        <p className={`mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          <T en="Share" hi="साझा करें" />
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canNativeShare && (
          <button type="button" className={`${btnClass} bg-brand-600 text-white`} onClick={handleNativeShare}>
            <T en="Share…" hi="साझा…" />
          </button>
        )}
        <button
          type="button"
          className={`${btnClass} bg-[#1877F2] text-white`}
          onClick={() => openShareWindow(facebookShareUrl(url))}
        >
          Facebook
        </button>
        <button
          type="button"
          className={`${btnClass} bg-[#25D366] text-white`}
          onClick={() => openShareWindow(whatsAppShareUrl(url, shareMessage))}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className={`${btnClass} bg-slate-800 text-white`}
          onClick={() => openShareWindow(twitterShareUrl(url, shareMessage))}
        >
          X
        </button>
        <button
          type="button"
          className={`${btnClass} bg-[#0A66C2] text-white`}
          onClick={() => openShareWindow(linkedInShareUrl(url))}
        >
          LinkedIn
        </button>
        <button
          type="button"
          className={`${btnClass} bg-slate-100 text-slate-700 ring-1 ring-slate-200`}
          onClick={() => openShareWindow(emailShareUrl(url, title, shareMessage))}
        >
          <T en="Email" hi="ईमेल" />
        </button>
        <button
          type="button"
          className={`${btnClass} bg-slate-100 text-slate-700 ring-1 ring-slate-200`}
          onClick={handleCopy}
        >
          {copied ? <T en="Copied!" hi="कॉपी!" /> : <T en="Copy link" hi="लिंक कॉपी" />}
        </button>
      </div>
    </div>
  );
}
