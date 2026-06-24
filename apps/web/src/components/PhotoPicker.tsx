import { useCallback, useEffect, useRef, useState } from 'react';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { classifyMicError, isSecureRecordingContext } from '@/lib/mediaPermissions';

interface PhotoPickerProps {
  onSelect: (file: File) => void;
  disabled?: boolean;
}

function cameraErrorMessage(kind: ReturnType<typeof classifyMicError>): { en: string; hi: string } {
  if (kind === 'insecure') {
    return {
      en: 'Camera needs HTTPS. Use the live app link or https://localhost — not http://.',
      hi: 'कैमरे के लिए HTTPS चाहिए। लाइव ऐप या https://localhost उपयोग करें।',
    };
  }
  if (kind === 'denied') {
    return {
      en: 'Camera access was blocked. Allow it in your browser site settings.',
      hi: 'कैमरा अवरुद्ध है। ब्राउज़र सेटिंग्स में अनुमति दें।',
    };
  }
  if (kind === 'notfound') {
    return {
      en: 'No camera found on this device.',
      hi: 'इस डिवाइस पर कोई कैमरा नहीं मिला।',
    };
  }
  return {
    en: 'Could not open the camera. Try Upload instead.',
    hi: 'कैमरा नहीं खुल सका। अपलोड आज़माएं।',
  };
}

export function PhotoPicker({ onSelect, disabled }: PhotoPickerProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const fallbackCameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    setCameraError('');
  }, [stopCamera]);

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onSelect(f);
    e.target.value = '';
  };

  const startCamera = async () => {
    if (disabled) return;
    setCameraError('');

    if (!isSecureRecordingContext() || !navigator.mediaDevices?.getUserMedia) {
      fallbackCameraRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const msg = cameraErrorMessage(classifyMicError(err));
      setCameraError(`${msg.en} / ${msg.hi}`);
      fallbackCameraRef.current?.click();
    }
  };

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
    return () => {
      if (!cameraOpen) stopCamera();
    };
  }, [cameraOpen, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        closeCamera();
        onSelect(file);
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryChange}
        disabled={disabled}
      />
      <input
        ref={fallbackCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleGalleryChange}
        disabled={disabled}
      />

      <BilingualLine
        en="Add a photo"
        hi="फोटो जोड़ें"
        enClass="mb-2 text-sm font-medium text-slate-700"
        hiClass="mb-2 text-xs text-slate-400"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-primary py-3 text-sm"
          onClick={startCamera}
          disabled={disabled}
        >
          📷 Take Photo
          <span className="font-hindi block text-xs font-normal opacity-90">फोटो लें</span>
        </button>
        <button
          type="button"
          className="btn-secondary py-3 text-sm"
          onClick={() => galleryRef.current?.click()}
          disabled={disabled}
        >
          🖼️ Upload
          <span className="font-hindi block text-xs font-normal opacity-90">अपलोड करें</span>
        </button>
      </div>

      {cameraError && !cameraOpen && (
        <p className="mt-2 text-xs text-amber-700">{cameraError}</p>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="min-h-0 flex-1 object-cover"
          />
          <div className="flex shrink-0 items-center justify-between gap-3 bg-black/90 px-4 py-4">
            <button type="button" className="btn-secondary text-sm" onClick={closeCamera}>
              <BilingualBtn en="Cancel" hi="रद्द" />
            </button>
            <button
              type="button"
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20"
              onClick={capturePhoto}
              aria-label="Capture photo"
            />
            <span className="w-20" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
