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

interface CompactClipRecorderProps {
  onClipReady: (blob: Blob, duration: number) => void | Promise<void>;
  disabled?: boolean;
  autoSave?: boolean;
  hasExistingClip?: boolean;
}

export function CompactClipRecorder({ onClipReady, disabled, autoSave, hasExistingClip }: CompactClipRecorderProps) {
  const { isRecording, duration, blob, errorKind, start, stop, reset } = useAudioRecorder();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoSavedBlobRef = useRef<Blob | null>(null);

  const handleSave = async () => {
    if (!blob || saving) return;
    setSaving(true);
    try {
      await onClipReady(blob, duration);
      reset();
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!autoSave || !expanded || isRecording || !blob || saving) return;
    if (autoSavedBlobRef.current === blob) return;
    autoSavedBlobRef.current = blob;
    setSaving(true);
    Promise.resolve(onClipReady(blob, duration))
      .then(() => {
        reset();
        setExpanded(false);
      })
      .finally(() => {
        setSaving(false);
        autoSavedBlobRef.current = null;
      });
  }, [autoSave, expanded, isRecording, blob, duration, onClipReady, reset, saving]);

  if (!expanded && !isRecording) {
    return (
      <button
        type="button"
        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
        onClick={() => setExpanded(true)}
        disabled={disabled}
      >
        🎙️ <BilingualBtn en={hasExistingClip ? 'Add clip' : 'Record'} hi={hasExistingClip ? 'क्लिप जोड़ें' : 'रिकॉर्ड'} />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 font-mono text-sm font-bold text-brand-600">{formatDuration(duration)}</p>
      {errorKind && (
        <div className="mb-2">
          <MicPermissionHelp kind={errorKind} onRetry={start} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!isRecording && !blob && (
          <>
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={start} disabled={disabled}>
              <BilingualBtn en="Start" hi="शुरू" />
            </button>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setExpanded(false)}>
              <BilingualBtn en="Cancel" hi="रद्द" />
            </button>
          </>
        )}
        {isRecording && (
          <button type="button" className="btn-primary bg-red-600 px-3 py-1.5 text-xs" onClick={stop}>
            <BilingualBtn en="Stop" hi="रोकें" />
          </button>
        )}
        {blob && !isRecording && !autoSave && (
          <div className="flex w-full flex-wrap items-center gap-3">
            <ClipPlayButton blob={blob} size="lg" />
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={handleSave} disabled={saving}>
              <BilingualBtn en="Save clip" hi="सहेजें" />
            </button>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={reset}>
              <BilingualBtn en="Re-record" hi="फिर से" />
            </button>
          </div>
        )}
        {saving && (
          <p className="text-xs font-medium text-brand-600">
            <BilingualBtn en="Saving…" hi="सहेज रहे हैं…" />
          </p>
        )}
      </div>
    </div>
  );
}

interface PromptClipListProps {
  clips: AudioClip[];
  onDelete: (clipId: string) => void;
}

export function PromptClipList({ clips, onDelete }: PromptClipListProps) {
  if (clips.length === 0) return null;

  return (
    <div className="space-y-2">
      <BilingualLine
        en={`Recordings (${clips.length})`}
        hi={`रिकॉर्डिंग (${clips.length})`}
        enClass="text-sm font-semibold uppercase tracking-wide text-slate-500"
        hiClass="text-xs text-slate-400"
      />
      {clips.map((clip, idx) => (
        <div key={clip.id} className="card flex items-start gap-3 py-3">
          <ClipPlayButton audioUrl={clip.audioUrl} size="md" />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            {clip.label && (
              <p className="text-sm font-medium text-slate-800">{clip.label}</p>
            )}
            <p className="text-xs text-slate-500">
              {clip.durationSeconds ? `${formatDuration(clip.durationSeconds)} · ` : ''}
              {clipStatusLabel(clip.status)}
            </p>
            {clip.transcript?.text && (
              <p className="mt-1 line-clamp-3 text-sm text-slate-700">{clip.transcript.text}</p>
            )}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            onClick={() => onDelete(clip.id)}
            aria-label="Delete clip"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
