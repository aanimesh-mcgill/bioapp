import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioClip } from '@/types';

export function useClipQueuePlayback(ordered: AudioClip[]) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const queueRef = useRef(false);

  const playIndex = useCallback(
    async (idx: number, queue: boolean) => {
      const clip = ordered[idx];
      if (!clip?.audioUrl) return;
      const audio = audioRef.current;
      if (!audio) return;

      queueRef.current = queue;
      setPlayingIndex(idx);
      if (audio.src !== clip.audioUrl) {
        audio.src = clip.audioUrl;
      }
      try {
        await audio.play();
      } catch {
        setPlayingIndex(null);
        queueRef.current = false;
      }
    },
    [ordered],
  );

  const toggleClip = useCallback(
    (idx: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (playingIndex === idx && !audio.paused) {
        audio.pause();
        queueRef.current = false;
        return;
      }

      void playIndex(idx, true);
    },
    [playIndex, playingIndex],
  );

  const stopQueue = useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    queueRef.current = false;
    setPlayingIndex(null);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (queueRef.current && playingIndex !== null && playingIndex < ordered.length - 1) {
        void playIndex(playingIndex + 1, true);
        return;
      }
      queueRef.current = false;
      setPlayingIndex(null);
    };

    const onPause = () => {
      if (audio.ended) return;
      if (!queueRef.current) setPlayingIndex(null);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
    };
  }, [ordered.length, playIndex, playingIndex, ordered]);

  return { audioRef, playingIndex, toggleClip, stopQueue };
}
