import { useEffect, useRef, useState } from 'react';

interface ClipPlayButtonProps {
  audioUrl?: string;
  blob?: Blob | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 rounded-lg text-sm',
  md: 'h-10 w-10 rounded-full text-base',
  lg: 'h-12 w-12 rounded-full text-xl',
};

export function ClipPlayButton({
  audioUrl,
  blob,
  className = '',
  size = 'md',
}: ClipPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const src = audioUrl || blobUrl;
  const ready = Boolean(src);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (playing) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
      <button
        type="button"
        className={`inline-flex shrink-0 items-center justify-center font-semibold ${
          sizeClasses[size]
        } ${
          ready
            ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
            : 'cursor-not-allowed bg-slate-100 text-slate-300'
        } ${className}`}
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? 'Pause clip' : 'Play clip'}
        title={ready ? undefined : 'Audio not ready yet / ऑडियो तैयार नहीं'}
      >
        {playing ? '⏸' : '▶'}
      </button>
    </>
  );
}
