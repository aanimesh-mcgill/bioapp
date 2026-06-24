import { useCallback, useEffect, useRef, useState } from 'react';
import { BilingualLine } from '@/components/BilingualText';
import type { AudioClip } from '@/types';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SpreadClipPlayerProps {
  clips: AudioClip[];
}

export function SpreadClipPlayer({ clips }: SpreadClipPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const readyClips = clips.filter((c) => c.audioUrl);

  const playFrom = useCallback(
    (idx: number) => {
      if (!readyClips[idx]?.audioUrl) return;
      if (playing && activeIdx === idx) {
        audioRef.current?.pause();
        setPlaying(false);
        return;
      }
      setActiveIdx(idx);
      setPlaying(true);
    },
    [readyClips, playing, activeIdx],
  );

  useEffect(() => {
    if (!playing || activeIdx === null) return;
    const clip = readyClips[activeIdx];
    const audio = audioRef.current;
    if (!audio || !clip?.audioUrl) return;
    audio.src = clip.audioUrl;
    audio.play().catch(() => {
      setPlaying(false);
      setActiveIdx(null);
    });
  }, [activeIdx, playing, readyClips]);

  const handleEnded = () => {
    if (activeIdx === null) return;
    const next = activeIdx + 1;
    if (next < readyClips.length) {
      setActiveIdx(next);
    } else {
      setPlaying(false);
      setActiveIdx(null);
    }
  };

  if (readyClips.length === 0) return null;

  return (
    <div>
      <audio ref={audioRef} preload="metadata" onEnded={handleEnded} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <BilingualLine
        en="Listen to this memory"
        hi="इस याद को सुनें"
        enClass="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800/70"
        hiClass="mb-3 text-xs text-amber-700/60"
      />
      <div className="flex flex-wrap gap-3">
        {readyClips.map((clip, idx) => {
          const isActive = playing && activeIdx === idx;
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => playFrom(idx)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 transition ${
                isActive
                  ? 'bg-brand-100 ring-brand-300'
                  : 'bg-amber-50/80 ring-amber-200/50 hover:bg-amber-100/80'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold ${
                  isActive ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
                }`}
              >
                {isActive ? '⏸' : '▶'}
              </span>
              <span className="text-xs font-medium text-amber-900">
                Clip {idx + 1}
                {clip.durationSeconds ? ` · ${formatDuration(clip.durationSeconds)}` : ''}
              </span>
            </button>
          );
        })}
      </div>
      {readyClips.length > 1 && (
        <p className="mt-2 text-center text-[10px] text-amber-700/60">
          Clips play in order automatically / क्लिप क्रम से स्वचालित चलेंगी
        </p>
      )}
    </div>
  );
}
