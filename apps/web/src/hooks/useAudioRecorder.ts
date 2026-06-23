import { useCallback, useRef, useState } from 'react';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  blob: Blob | null;
  error: string | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    blob: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setState((s) => ({
        ...s,
        duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setState((s) => ({ ...s, blob, isRecording: false, isPaused: false }));
        stopTimer();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimer();
      setState({ isRecording: true, isPaused: false, duration: 0, blob: null, error: null });
    } catch {
      setState((s) => ({
        ...s,
        error: 'Microphone access denied. Please allow microphone permission.',
      }));
    }
  }, [startTimer, stopTimer]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    setState({ isRecording: false, isPaused: false, duration: 0, blob: null, error: null });
  }, [stopTimer]);

  return { ...state, start, stop, reset };
}
