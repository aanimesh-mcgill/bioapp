import { useState } from 'react';
import { BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';
import { ClipRecorder } from '@/components/ClipRecorder';

export type StoryNameResult =
  | { type: 'text'; name: string }
  | { type: 'audio'; blob: Blob; duration: number };

interface StoryNamePromptProps {
  open: boolean;
  busy?: boolean;
  statusMessage?: string;
  onCancel: () => void;
  onSubmit: (result: StoryNameResult) => void | Promise<void>;
}

export function StoryNamePrompt({ open, busy, statusMessage, onCancel, onSubmit }: StoryNamePromptProps) {
  const t = usePickText();
  const [mode, setMode] = useState<'type' | 'speak'>('type');
  const [name, setName] = useState('');
  const [recording, setRecording] = useState<{ blob: Blob; duration: number } | null>(null);

  if (!open) return null;

  const canSubmit =
    !busy && ((mode === 'type' && name.trim().length > 0) || (mode === 'speak' && recording !== null));

  const handleSubmit = async () => {
    if (mode === 'type' && name.trim()) {
      await onSubmit({ type: 'text', name: name.trim() });
    } else if (mode === 'speak' && recording) {
      await onSubmit({ type: 'audio', blob: recording.blob, duration: recording.duration });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="story-name-title"
      >
        <h2 id="story-name-title" className="text-lg font-bold text-slate-900">
          {t({ en: 'Name this story', hi: 'कहानी का नाम' })}
        </h2>
        <BilingualLine
          en="Give this memory a short name — type it or say it out loud."
          hi="इस याद को एक छोटा नाम दें — टाइप करें या बोलकर बताएं।"
          enClass="mt-1 text-sm text-slate-600"
          hiClass="mt-1 text-sm text-slate-600"
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'type' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setMode('type')}
            disabled={busy}
          >
            {t({ en: 'Type', hi: 'टाइप' })}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'speak' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setMode('speak')}
            disabled={busy}
          >
            {t({ en: 'Speak', hi: 'बोलें' })}
          </button>
        </div>

        {mode === 'type' ? (
          <input
            className="input-field mt-4"
            placeholder={t({ en: 'e.g. Wedding day, 1985', hi: 'जैसे शादी का दिन' })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            autoFocus
          />
        ) : (
          <div className="mt-4 space-y-3">
            <ClipRecorder
              autoSave
              onClipReady={async (blob, duration) => {
                setRecording({ blob, duration });
              }}
            />
            {recording && (
              <p className="text-center text-xs text-green-700">
                <T
                  en="Recording captured — tap Save below."
                  hi="रिकॉर्डिंग हो गई — नीचे सहेजें दबाएं।"
                />
              </p>
            )}
          </div>
        )}

        {statusMessage && (
          <p className="mt-3 text-center text-sm text-amber-700">{statusMessage}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={busy}>
            <BilingualBtn en="Cancel" hi="रद्द" />
          </button>
          <button type="button" className="btn-primary flex-1" onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? (
              <BilingualBtn en="Saving…" hi="सहेज रहे…" />
            ) : (
              <BilingualBtn en="Save story" hi="कहानी सहेजें" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
