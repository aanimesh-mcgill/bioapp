import { useCallback, useRef, useState } from 'react';
import { classifyMicError, type MicErrorKind } from '@/lib/mediaPermissions';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  blob: Blob | null;
  errorKind: MicErrorKind | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    blob: null,
    errorKind: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      releaseStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        releaseStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setState((s) => ({ ...s, blob, isRecording: false, isPaused: false }));
        stopTimer();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimer();
      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        blob: null,
        errorKind: null,
      });
    } catch (err) {
      releaseStream();
      const kind = classifyMicError(err);
      setState((s) => ({
        ...s,
        isRecording: false,
        errorKind: kind,
      }));
    }
  }, [releaseStream, startTimer, stopTimer]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    releaseStream();
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      blob: null,
      errorKind: null,
    });
  }, [releaseStream, stopTimer]);

  return { ...state, start, stop, reset };
};
