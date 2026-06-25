import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BilingualLine, T } from '@/components/BilingualText';
import { useUiLocale } from '@/context/UiLocaleContext';
import { clipDisplayLabel, clipsInNumberingScope, resolveClipNumber } from '@/lib/clipDisplay';
import type { AudioClip } from '@/types';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SpreadClipPlayerProps {
  clips: AudioClip[];
  autoPlay?: boolean;
  /** Pin transport + clip row above page footer (QR / audiobook listen). */
  sticky?: boolean;
  /** Fired after the last clip in the queue finishes (or immediately if there are no clips). */
  onQueueComplete?: () => void;
}

export function SpreadClipPlayer({
  clips,
  autoPlay = false,
  sticky = false,
  onQueueComplete,
}: SpreadClipPlayerProps) {
  const { locale } = useUiLocale();
  const audioRef = useRef<HTMLAudioElement>(null);
  const prefetchRef = useRef<HTMLAudioElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const advancingRef = useRef(false);
  const onQueueCompleteRef = useRef(onQueueComplete);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  onQueueCompleteRef.current = onQueueComplete;

  const readyClips = useMemo(() => {
    const seen = new Set<string>();
    return clips.filter((clip) => {
      if (!clip.audioUrl || seen.has(clip.id)) return false;
      seen.add(clip.id);
      return true;
    });
  }, [clips]);

  const numberingScope = useMemo(
    () => clipsInNumberingScope(clips, readyClips),
    [clips, readyClips],
  );

  const repeatingClips = useMemo(() => {
    if (readyClips.length === 0) return [];
    return [...readyClips, ...readyClips, ...readyClips];
  }, [readyClips]);

  const clipIds = useMemo(() => readyClips.map((c) => c.id).join(','), [readyClips]);

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

  const toggleTransport = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || readyClips.length === 0) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    const idx = activeIdx ?? 0;
    setActiveIdx(idx);
    setPlaying(true);
  }, [playing, activeIdx, readyClips.length]);

  const handleSeek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  useEffect(() => {
    if (activeIdx === null) return;
    const nextClip = readyClips[activeIdx + 1];
    const prefetch = prefetchRef.current;
    if (!nextClip?.audioUrl || !prefetch) return;
    prefetch.src = nextClip.audioUrl;
    prefetch.preload = 'auto';
    prefetch.load();
  }, [activeIdx, readyClips]);

  useEffect(() => {
    if (!stripRef.current || readyClips.length === 0) return;
    const el = stripRef.current;
    el.scrollLeft = el.scrollWidth / 3;
  }, [clipIds, readyClips.length]);

  useEffect(() => {
    if (activeIdx === null || !stripRef.current) return;
    const el = stripRef.current.querySelector(`[data-clip-idx="${activeIdx}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  const readyClipsRef = useRef(readyClips);
  readyClipsRef.current = readyClips;

  useEffect(() => {
    if (!playing || activeIdx === null) return;
    const clip = readyClipsRef.current[activeIdx];
    const audio = audioRef.current;
    if (!audio || !clip?.audioUrl) return;

    if (audio.dataset.clipId === clip.id && !audio.ended) {
      if (audio.paused) {
        advancingRef.current = true;
        void audio.play().catch(() => {
          setPlaying(false);
        });
      }
      return;
    }

    advancingRef.current = true;
    audio.dataset.clipId = clip.id;
    audio.src = clip.audioUrl;
    setCurrentTime(0);
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
      setCurrentTime(0);
      setDuration(0);
      onQueueCompleteRef.current?.();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration || 0);
  };

  if (readyClips.length === 0) return null;

  const activeClip = activeIdx !== null ? readyClips[activeIdx] : null;
  const activeNumber = activeClip ? resolveClipNumber(activeClip, numberingScope) : null;
  const seekMax = duration > 0 ? duration : activeClip?.durationSeconds ?? 0;

  const shellClass = sticky
    ? 'sticky bottom-0 z-20 -mx-3 rounded-t-2xl border-t border-amber-200/70 bg-[#faf6f0]/97 px-3 py-4 shadow-[0_-8px_32px_-8px_rgba(80,50,20,0.2)] backdrop-blur-md sm:-mx-6 sm:px-6'
    : '';

  return (
    <div className={shellClass}>
      <audio
        ref={audioRef}
        preload="auto"
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <audio ref={prefetchRef} preload="auto" className="hidden" aria-hidden />

      <BilingualLine
        en="Listen to this memory"
        hi="इस याद को सुनें"
        enClass="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800/70"
        hiClass="mb-3 text-xs text-amber-700/60"
      />

      <div className="mb-4 rounded-xl bg-amber-50/90 p-3 ring-1 ring-amber-200/60">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTransport}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white shadow-sm"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-amber-950">
              {activeClip && activeNumber !== null
                ? clipDisplayLabel(activeClip, activeNumber, locale)
                : locale === 'hi'
                  ? 'क्लिप चुनें'
                  : 'Select a clip'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-amber-800/70">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={seekMax || 1}
                step={0.1}
                value={Math.min(currentTime, seekMax || 0)}
                disabled={!activeClip}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="h-1.5 min-w-0 flex-1 cursor-pointer accent-brand-600 disabled:opacity-40"
                aria-label="Seek"
              />
              <span className="w-10 shrink-0 text-[11px] tabular-nums text-amber-800/70">
                {formatTime(seekMax)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div ref={stripRef} className="overflow-x-auto pt-1 pb-1">
        <div className="flex min-w-max gap-3">
          {repeatingClips.map((clip, index) => {
            const idx = index % readyClips.length;
            const isActive = playing && activeIdx === idx;
            const clipNumber = resolveClipNumber(clip, numberingScope);
            return (
              <button
                key={`${clip.id}-${index}`}
                type="button"
                data-clip-idx={idx}
                onClick={() => playFrom(idx)}
                className={`flex min-w-[148px] max-w-[200px] items-center gap-2 rounded-xl px-3 py-2 ring-1 transition ${
                  isActive
                    ? 'bg-brand-100 ring-brand-300'
                    : 'bg-amber-50/80 ring-amber-200/50 hover:bg-amber-100/80'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
                    isActive ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
                  }`}
                >
                  {isActive && playing ? '⏸' : '▶'}
                </span>
                <span className="min-w-0 text-left text-xs font-medium leading-snug text-amber-900">
                  <span className="line-clamp-2">{clipDisplayLabel(clip, clipNumber, locale)}</span>
                  {clip.durationSeconds ? (
                    <span className="mt-0.5 block text-[10px] text-amber-700/60">
                      {formatTime(clip.durationSeconds)}
                    </span>
                  ) : null}
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
