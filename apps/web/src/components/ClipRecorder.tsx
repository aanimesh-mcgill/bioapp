import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useClipQueuePlayback } from '@/hooks/useClipQueuePlayback';
import { MicPermissionHelp } from '@/components/MicPermissionHelp';
import { ClipPlayButton } from '@/components/ClipPlayButton';
import { BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { clipStatusLabel, formatClipErrorMessage, isClipRemoved } from '@/lib/bilingualUi';
import {
  clipDisplayLabel,
  clipsInNumberingScope,
  defaultClipLabel,
  isAutoClipLabel,
  resolveClipNumber,
} from '@/lib/clipDisplay';
import { retryClipTranscription } from '@/services/storySessions';
import type { AudioClip } from '@/types';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ClipListProps {
  clips: AudioClip[];
  clipOrder: string[];
  /** When set, clip numbers are resolved within this subset (e.g. one prompt's clips). */
  numberingScopeClips?: AudioClip[];
  onMoveUp: (clipId: string) => void;
  onMoveDown: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  onLabelChange?: (clipId: string, label: string) => void;
}

function ClipNameField({
  clip,
  clipNumber,
  locale,
  onLabelChange,
}: {
  clip: AudioClip;
  clipNumber: number;
  locale: ReturnType<typeof useUiLocale>['locale'];
  onLabelChange?: (clipId: string, label: string) => void;
}) {
  const t = usePickText();
  const resolvedName = clipDisplayLabel(clip, clipNumber, locale);
  const [name, setName] = useState(resolvedName);

  useEffect(() => {
    setName(clipDisplayLabel(clip, clipNumber, locale));
  }, [clip.id, clip.label, clipNumber, locale]);

  return (
    <input
      type="text"
      className="input-field w-full py-1 text-sm"
      value={name}
      placeholder={defaultClipLabel(clipNumber, locale)}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        const trimmed = name.trim();
        if (!trimmed || isAutoClipLabel(trimmed, locale)) {
          if (clip.label?.trim()) onLabelChange?.(clip.id, '');
          setName(defaultClipLabel(clipNumber, locale));
          return;
        }
        if (trimmed !== clip.label?.trim()) onLabelChange?.(clip.id, trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      aria-label={t({ en: 'Clip name', hi: 'क्लिप का नाम' })}
    />
  );
}

export function ClipList({
  clips,
  clipOrder,
  numberingScopeClips,
  onMoveUp,
  onMoveDown,
  onDelete,
  onLabelChange,
}: ClipListProps) {
  const t = usePickText();
  const { locale } = useUiLocale();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [displayOrder, setDisplayOrder] = useState(clipOrder);

  useEffect(() => {
    setDisplayOrder(clipOrder);
  }, [clipOrder]);

  const ordered = useMemo(
    () =>
      displayOrder
        .map((id) => clips.find((c) => c.id === id))
        .filter((c): c is AudioClip => Boolean(c) && !isClipRemoved(c!)),
    [displayOrder, clips],
  );

  const numberingScope = useMemo(
    () => numberingScopeClips ?? clipsInNumberingScope(clips, ordered),
    [numberingScopeClips, clips, ordered],
  );

  const { audioRef, playingIndex, toggleClip } = useClipQueuePlayback(ordered);

  if (ordered.length === 0) return null;

  const handleRetry = async (clipId: string) => {
    setRetryingId(clipId);
    try {
      await retryClipTranscription(clipId);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = (clipId: string) => {
    setDisplayOrder((prev) => prev.filter((id) => id !== clipId));
    onDelete(clipId);
  };

  const moveClip = (clipId: string, direction: 'up' | 'down') => {
    setDisplayOrder((prev) => {
      const next = [...prev];
      const idx = next.indexOf(clipId);
      if (idx < 0) return prev;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    if (direction === 'up') onMoveUp(clipId);
    else onMoveDown(clipId);
  };

  return (
    <div className="space-y-2">
      <audio ref={audioRef} preload="metadata" className="hidden" />
      <BilingualLine
        en={`Recordings (${ordered.length})`}
        hi={`रिकॉर्डिंग (${ordered.length})`}
        enClass="text-sm font-semibold uppercase tracking-wide text-slate-500"
        hiClass="text-sm font-semibold text-slate-500"
      />
      <p className="text-xs text-heritage-muted">
        {t({
          en: 'Top to bottom = playback order. Clip numbers stay fixed when you reorder.',
          hi: 'ऊपर से नीचे = चलने का क्रम। क्रम बदलने पर क्लिप नंबर वही रहते हैं।',
        })}
      </p>
      <div className="space-y-2">
        {ordered.map((clip, idx) => {
          const isPlaying = playingIndex === idx;
          const canPlay = Boolean(clip.audioUrl);
          const showStatus = clip.status !== 'ready';
          const clipNumber = resolveClipNumber(clip, numberingScope);

          return (
            <div key={clip.id} className="card flex items-start gap-3 py-3">
              <span
                className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isPlaying ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
                }`}
                title={t({ en: 'Clip number (fixed)', hi: 'क्लिप नंबर (स्थिर)' })}
              >
                {clipNumber}
              </span>
              <button
                type="button"
                className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
                  canPlay
                    ? isPlaying
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                    : 'cursor-not-allowed bg-slate-100 text-slate-300'
                }`}
                onClick={() => toggleClip(idx)}
                disabled={!canPlay}
                aria-label={isPlaying ? 'Pause clip' : 'Play clip'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <div className="min-w-0 flex-1">
                {onLabelChange ? (
                  <ClipNameField
                    clip={clip}
                    clipNumber={clipNumber}
                    locale={locale}
                    onLabelChange={onLabelChange}
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-800">
                    {clipDisplayLabel(clip, clipNumber, locale)}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-heritage-muted">
                  {t({ en: `Play order: ${idx + 1}`, hi: `चलने का क्रम: ${idx + 1}` })}
                  {clip.durationSeconds ? ` · ${formatDuration(clip.durationSeconds)}` : ''}
                </p>
                {showStatus && (
                  <p className="text-xs text-slate-500">{clipStatusLabel(clip.status, locale)}</p>
                )}
                {clip.status === 'error' && clip.errorMessage && clip.errorMessage !== 'removed' && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-red-600">
                    {formatClipErrorMessage(clip.errorMessage, locale)}
                  </p>
                )}
                {clip.status === 'error' && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-brand-600 underline"
                    disabled={retryingId === clip.id}
                    onClick={() => void handleRetry(clip.id)}
                  >
                    {retryingId === clip.id
                      ? t({ en: 'Retrying…', hi: 'फिर कोशिश…' })
                      : t({ en: 'Retry transcription', hi: 'फिर से प्रतिलेखन' })}
                  </button>
                )}
                {clip.transcript?.text && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{clip.transcript.text}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-base text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  onClick={() => moveClip(clip.id, 'up')}
                  disabled={idx === 0}
                  aria-label="Move earlier in playback"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-base text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  onClick={() => moveClip(clip.id, 'down')}
                  disabled={idx === ordered.length - 1}
                  aria-label="Move later in playback"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-base text-red-500 hover:bg-red-50"
                  onClick={() => handleDelete(clip.id)}
                  aria-label="Delete clip"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ClipRecorderProps {
  onClipReady: (blob: Blob, duration: number) => void | Promise<void>;
  disabled?: boolean;
  autoSave?: boolean;
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
      .then(() => {
        reset();
        autoSavedBlobRef.current = null;
      })
      .finally(() => setSaving(false));
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
            en={
              hasExistingClip
                ? 'Tap to record another segment — adds to the list above'
                : 'Tap Record — allow microphone when asked'
            }
            hi={
              hasExistingClip
                ? 'और एक segment रिकॉर्ड करें — ऊपर की सूची में जुड़ेगा'
                : 'Record दबाएं — माइक की अनुमति दें'
            }
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
          <button type="button" className="btn-primary flex-1 text-sm" onClick={start} disabled={disabled}>
            <BilingualBtn
              en={hasExistingClip ? 'Add Another Clip' : 'Record Clip'}
              hi={hasExistingClip ? 'और क्लिप जोड़ें' : 'क्लिप रिकॉर्ड'}
            />
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
