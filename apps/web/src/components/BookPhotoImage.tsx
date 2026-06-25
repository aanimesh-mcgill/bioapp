import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { T } from '@/components/BilingualText';
import type { BookPhoto } from '@/types';

interface BookPhotoImageProps {
  photo: BookPhoto;
  className?: string;
}

async function resolvePhotoSrc(photo: BookPhoto): Promise<string> {
  if (photo.imageUrl?.trim()) {
    return photo.imageUrl;
  }
  if (photo.imageStoragePath?.trim()) {
    return getDownloadURL(ref(storage, photo.imageStoragePath));
  }
  throw new Error('no image');
}

export function BookPhotoImage({ photo, className = '' }: BookPhotoImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);
  const fillParent = className.includes('h-full');
  const shellClass = fillParent
    ? `flex h-full w-full items-center justify-center ${className}`
    : `flex min-h-[200px] items-center justify-center ${className}`;
  const imgClass = fillParent
    ? className
    : `mx-auto max-h-[min(50dvh,400px)] min-h-[120px] w-full object-contain ${className}`;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setRetried(false);
    setSrc(null);

    void resolvePhotoSrc(photo)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.imageUrl, photo.imageStoragePath]);

  const handleError = () => {
    if (retried || !photo.imageStoragePath?.trim()) {
      setFailed(true);
      return;
    }
    setRetried(true);
    void getDownloadURL(ref(storage, photo.imageStoragePath))
      .then((url) => setSrc(url))
      .catch(() => setFailed(true));
  };

  if (failed) {
    return (
      <div
        className={`${shellClass} flex-col gap-2 px-4 text-center text-sm text-heritage-muted`}
      >
        <span className="text-3xl">🖼️</span>
        <p>
          <T
            en="Could not load this photo. Remove it and add again with Take Photo or Upload."
            hi="यह फोटो नहीं दिख सकी। हटाकर फिर से जोड़ें।"
          />
        </p>
      </div>
    );
  }

  if (!src) {
    return (
      <div className={shellClass}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={handleError}
      className={imgClass}
    />
  );
}
