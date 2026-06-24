import { useEffect, useState } from 'react';
import { qrCodeDataUrl } from '@/lib/qrCode';

interface QrCodeDisplayProps {
  url: string;
  label?: string;
  size?: number;
}

export function QrCodeDisplay({ url, label, size = 160 }: QrCodeDisplayProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    qrCodeDataUrl(url, size)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(
            `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <p className="text-center text-xs font-medium text-slate-600">{label}</p>}
      {src ? (
        <img src={src} alt={`QR code for ${label ?? url}`} width={size} height={size} className="rounded-lg" />
      ) : (
        <div
          className="animate-pulse rounded-lg bg-slate-200"
          style={{ width: size, height: size }}
          aria-hidden
        />
      )}
      <p className="max-w-[200px] truncate text-center text-[10px] text-slate-400">{url}</p>
    </div>
  );
}
