import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MicPermissionHelp } from '@/components/MicPermissionHelp';
import { ClipPlayButton } from '@/components/ClipPlayButton';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { clipStatusLabel } from '@/lib/bilingualUi';
import type { AudioClip } from '@/types';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ClipListProps {
  clips: AudioClip[];
  clipOrder: string[];
  onMoveUp: (clipId: string) => void;
  onMoveDown: (clipId: string) => void;
  onDelete: (clipId: string) => void;
}

export function ClipList({ clips, clipOrder, onMoveUp, onMoveDown, onDelete }: ClipListProps) {
  const ordered = clipOrder
    .map((id) => clips.find((c) => c.id === id))
    .filter(Boolean) as AudioClip[];
  const repeatingOrdered =
    ordered.length <= 1 ? ordered : [...ordered, ...ordered, ...ordered];
  const baseCount = ordered.length;

  if (ordered.length === 0) return null;

  return (
    <div className="space-y-2">
      <BilingualLine
        en={`Recordings (${ordered.length})`}
        hi={`रिकॉर्डिंग (${ordered.length})`}
        enClass="text-sm font-semibold uppercase tracking-wide text-slate-500"
        hiClass="text-xs text-slate-400"
      />
      <div className="overflow-x-auto pt-1">
        <div className="flex min-w-max gap-3">
          {repeatingOrdered.map((clip, idx) => {
            const normalizedIdx = idx % baseCount;
            const showActions = baseCount <= 1 || (idx >= baseCount && idx < baseCount * 2);
            return (
              <div key={`${clip.id}-${idx}`} className="card flex w-80 shrink-0 items-center gap-3 py-3">
                <ClipPlayButton audioUrl={clip.audioUrl} size="md" />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                  {normalizedIdx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {clip.label ?? `Clip ${normalizedIdx + 1} / क्लिप ${normalizedIdx + 1}`}
                    {clip.durationSeconds ? ` · ${formatDuration(clip.durationSeconds)}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">{clipStatusLabel(clip.status)}</p>
                  {clip.transcript?.text && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{clip.transcript.text}</p>
                  )}
                </div>
                {showActions && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      onClick={() => onMoveUp(clip.id)}
                      disabled={normalizedIdx === 0}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      onClick={() => onMoveDown(clip.id)}
                      disabled={normalizedIdx === ordered.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                      onClick={() => onDelete(clip.id)}
                      aria-label="Delete clip"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ClipRecorderProps {
  onClipReady: (blob: Blob, duration: number) => void | Promise<void>;
  disabled?: boolean;
  /** Save automatically when recording stops (no manual Save step). */
  autoSave?: boolean;
  /** Hint shown when recordings already exist — user can add another segment. */
  hasExistingClip?: boolean;
}

export function ClipRecorder({ onClipReady, disabled, autoSave, hasExistingClip }: ClipRecorderProps) {
  const { isRecording, duration, blob, errorKind, start, stop, reset } = useAudioRecorder();
  const [saving, setSaving] = useState(false);
  const autoSavedBlobRef = useRef<Blob | null>(null);

  const handleSaveClip = async () => {
    if (!blob || saving) return;
    setSaving(true);
    try {
      await onClipReady(blob, duration);
      reset();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!autoSave || isRecording || !blob || saving) return;
    if (autoSavedBlobRef.current === blob) return;
    autoSavedBlobRef.current = blob;
    setSaving(true);
    Promise.resolve(onClipReady(blob, duration))
      .then(() => reset())
      .finally(() => {
        setSaving(false);
        autoSavedBlobRef.current = null;
      });
  }, [autoSave, isRecording, blob, duration, onClipReady, reset, saving]);

  return (
    <div className="flex flex-col items-center">
      <div
        className={`mb-4 flex h-28 w-28 items-center justify-center rounded-full transition ${
          isRecording ? 'bg-red-100 animate-pulse' : 'bg-brand-100'
        }`}
      >
        <span className="text-4xl">{isRecording ? '🔴' : '🎙️'}</span>
      </div>

      <p className="mb-1 text-2xl font-mono font-bold text-brand-600">{formatDuration(duration)}</p>
      <div className="mb-4 text-center text-xs text-slate-500">
        {isRecording ? (
          <BilingualLine
            en="Recording… tap stop when done"
            hi="रिकॉर्डिंग… समाप्त होने पर Stop दबाएं"
            enClass=""
            hiClass="text-slate-400"
          />
        ) : blob && autoSave && saving ? (
          <BilingualLine
            en="Saving clip…"
            hi="क्लिप सहेजी जा रही है…"
            enClass=""
            hiClass="text-slate-400"
          />
        ) : blob ? (
          <BilingualLine
            en="Clip ready — save or re-record"
            hi="क्लिप तैयार — सहेजें या फिर से रिकॉर्ड करें"
            enClass=""
            hiClass="text-slate-400"
          />
        ) : (
          <BilingualLine
            en={hasExistingClip ? 'Tap to record another segment — adds to the list above' : 'Tap Record — allow microphone when asked'}
            hi={hasExistingClip ? 'और एक segment रिकॉर्ड करें — ऊपर की सूची में जुड़ेगा' : 'Record दबाएं — माइक की अनुमति दें'}
            enClass=""
            hiClass="text-slate-400"
          />
        )}
      </div>

      {errorKind && (
        <div className="mb-3 w-full">
          <MicPermissionHelp kind={errorKind} onRetry={start} />
        </div>
      )}

      <div className="flex w-full flex-wrap items-center justify-center gap-3">
        {!isRecording && !blob && !saving && (
          <button
            type="button"
            className="btn-primary flex-1 text-sm"
            onClick={start}
            disabled={disabled}
          >
            <BilingualBtn en={hasExistingClip ? 'Add Another Clip' : 'Record Clip'} hi={hasExistingClip ? 'और क्लिप जोड़ें' : 'क्लिप रिकॉर्ड'} />
          </button>
        )}
        {isRecording && (
          <button type="button" className="btn-primary flex-1 bg-red-600 text-sm" onClick={stop}>
            <BilingualBtn en="Stop" hi="रोकें" />
          </button>
        )}
        {saving && (
          <p className="text-sm font-medium text-brand-600">
            <BilingualBtn en="Saving…" hi="सहेज रहे हैं…" />
          </p>
        )}
        {blob && !isRecording && !autoSave && (
          <>
            <ClipPlayButton blob={blob} size="lg" />
            <button type="button" className="btn-secondary flex-1 text-sm" onClick={reset}>
              <BilingualBtn en="Re-record" hi="फिर से रिकॉर्ड" />
            </button>
            <button type="button" className="btn-primary flex-1 text-sm" onClick={handleSaveClip} disabled={saving}>
              <BilingualBtn en="Save Clip" hi="क्लिप सहेजें" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
