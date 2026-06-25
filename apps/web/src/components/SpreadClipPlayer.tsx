import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BilingualLine, T } from '@/components/BilingualText';
import type { AudioClip } from '@/types';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SpreadClipPlayerProps {
  clips: AudioClip[];
  autoPlay?: boolean;
  /** Fired after the last clip in the queue finishes (or immediately if there are no clips). */
  onQueueComplete?: () => void;
}

export function SpreadClipPlayer({ clips, autoPlay = false, onQueueComplete }: SpreadClipPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const prefetchRef = useRef<HTMLAudioElement>(null);
  const advancingRef = useRef(false);
  const onQueueCompleteRef = useRef(onQueueComplete);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  onQueueCompleteRef.current = onQueueComplete;

  const readyClips = useMemo(() => {
    const seen = new Set<string>();
    return clips.filter((clip) => {
      if (!clip.audioUrl || seen.has(clip.id)) return false;
      seen.add(clip.id);
      return true;
    });
  }, [clips]);

  const clipIds = useMemo(() => readyClips.map((c) => c.id).join(','), [readyClips]);

  const playFrom = useCallback(
    (idx: number) => {
      if (!readyClips[idx]?.audioUrl) return;
      if (playing && activeIdx === idx) {
        audioRef.current?.pause();
        setPlaying(false);
        setActiveIdx(null);
        return;
      }
      setActiveIdx(idx);
      setPlaying(true);
    },
    [readyClips, playing, activeIdx],
  );

  useEffect(() => {
    if (activeIdx === null) return;
    const nextClip = readyClips[activeIdx + 1];
    const prefetch = prefetchRef.current;
    if (!nextClip?.audioUrl || !prefetch) return;
    prefetch.src = nextClip.audioUrl;
    prefetch.preload = 'auto';
    prefetch.load();
  }, [activeIdx, readyClips]);

  const readyClipsRef = useRef(readyClips);
  readyClipsRef.current = readyClips;

  useEffect(() => {
    if (!playing || activeIdx === null) return;
    const clip = readyClipsRef.current[activeIdx];
    const audio = audioRef.current;
    if (!audio || !clip?.audioUrl) return;

    // Parent re-renders pass a new clips array — don't restart if this clip is already playing.
    if (audio.dataset.clipId === clip.id && !audio.ended) {
      if (audio.paused) {
        advancingRef.current = true;
        void audio.play().catch(() => {
          setPlaying(false);
          setActiveIdx(null);
        });
      }
      return;
    }

    advancingRef.current = true;
    audio.dataset.clipId = clip.id;
    audio.src = clip.audioUrl;
    void audio.play().catch(() => {
      setPlaying(false);
      setActiveIdx(null);
    });
  }, [activeIdx, playing, clipIds]);

  useEffect(() => {
    if (!autoPlay) return;
    if (readyClips.length === 0) {
      onQueueCompleteRef.current?.();
      return;
    }
    setActiveIdx(0);
    setPlaying(true);
  }, [autoPlay, clipIds, readyClips.length]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  const handlePlaying = () => {
    advancingRef.current = false;
    setPlaying(true);
  };

  const handlePause = () => {
    if (advancingRef.current) return;
    const audio = audioRef.current;
    if (audio && !audio.ended) {
      setPlaying(false);
    }
  };

  const handleEnded = () => {
    if (activeIdx === null) return;
    const next = activeIdx + 1;
    if (next < readyClips.length) {
      advancingRef.current = true;
      setActiveIdx(next);
    } else {
      advancingRef.current = false;
      setPlaying(false);
      setActiveIdx(null);
      onQueueCompleteRef.current?.();
    }
  };

  if (readyClips.length === 0) return null;

  return (
    <div>
      <audio
        ref={audioRef}
        preload="auto"
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
      />
      <audio ref={prefetchRef} preload="auto" className="hidden" aria-hidden />

      <BilingualLine
        en="Listen to this memory"
        hi="इस याद को सुनें"
        enClass="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800/70"
        hiClass="mb-3 text-xs text-amber-700/60"
      />
      <div className="overflow-x-auto pt-1">
        <div className="flex min-w-max gap-3">
          {readyClips.map((clip, idx) => {
            const isActive = playing && activeIdx === idx;
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => playFrom(idx)}
                className={`flex min-w-[140px] items-center gap-2 rounded-xl px-3 py-2 ring-1 transition ${
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
      </div>
      {readyClips.length > 1 && (
        <p className="mt-2 text-center text-[10px] text-amber-700/60">
          <T en="Clips play in order automatically" hi="क्लिप क्रम से स्वचालित चलेंगी" />
        </p>
      )}
    </div>
  );
}
