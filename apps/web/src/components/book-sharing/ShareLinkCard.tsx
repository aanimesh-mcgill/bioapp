import type { ReactNode } from 'react';
import { BilingualBtn, T } from '@/components/BilingualText';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { usePickText } from '@/context/UiLocaleContext';

export function ShareLinkCard({
  title,
  meta,
  url,
  showQr = false,
  qrSize = 120,
  headerAction,
  onCopy,
}: {
  title?: string;
  meta?: string;
  url: string;
  showQr?: boolean;
  qrSize?: number;
  headerAction?: ReactNode;
  onCopy?: () => void;
}) {
  const t = usePickText();

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {(title || headerAction) && (
        <div className="mb-1 flex items-start justify-between gap-2">
          {title && <p className="font-semibold text-slate-900">{title}</p>}
          {headerAction}
        </div>
      )}
      {meta && <p className="mb-1 text-xs text-slate-500">{meta}</p>}
      <p className="break-all text-sm text-brand-700">{url}</p>
      <div className={`mt-3 ${showQr ? 'flex flex-col items-center gap-3 sm:flex-row sm:items-start' : ''}`}>
        {showQr && (
          <QrCodeDisplay
            url={url}
            label={t({ en: 'Scan to open', hi: 'खोलने के लिए स्कैन करें' })}
            size={qrSize}
          />
        )}
        <button
          type="button"
          className={`text-xs font-semibold text-brand-600 ${showQr ? 'sm:mt-2' : ''}`}
          onClick={handleCopy}
        >
          <BilingualBtn en="Copy link" hi="लिंक कॉपी करें" />
        </button>
      </div>
    </div>
  );
}

export function ShareLinkEmpty({
  en,
  hi,
}: {
  en: string;
  hi: string;
}) {
  const t = usePickText();
  return (
    <p className="text-sm text-slate-500">
      <T en={en} hi={hi} />
    </p>
  );
}
