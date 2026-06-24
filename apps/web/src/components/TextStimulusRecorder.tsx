import { BilingualLine } from '@/components/BilingualText';
import { ClipRecorder, ClipList } from '@/components/ClipRecorder';
import type { AudioClip, StorySession, TextStimulusData } from '@/types';

interface TextStimulusRecorderProps {
  session: StorySession;
  textStimulus: TextStimulusData;
  clips: AudioClip[];
  onClipReady: (blob: Blob, duration: number) => void;
  onMoveUp: (clipId: string) => void;
  onMoveDown: (clipId: string) => void;
  onDelete: (clipId: string) => void;
}

export function TextStimulusRecorder({
  session,
  textStimulus,
  clips,
  onClipReady,
  onMoveUp,
  onMoveDown,
  onDelete,
}: TextStimulusRecorderProps) {
  return (
    <div className="space-y-4">
      <div className="card sticky top-0 z-10 border-l-4 border-l-accent-400 bg-white/95 backdrop-blur-sm">
        <BilingualLine
          en="Your prompt — speak about this"
          hi="आपका प्रश्न — इसके बारे में बोलें"
          enClass="text-xs font-semibold uppercase tracking-wide text-slate-500"
          hiClass="text-xs text-slate-400"
        />
        <p className="mt-2 text-sm leading-relaxed italic text-slate-800">"{textStimulus.content}"</p>
        {(textStimulus.date || textStimulus.year) && (
          <p className="mt-1 text-xs text-slate-500">{textStimulus.date ?? textStimulus.year}</p>
        )}
      </div>

      <ClipList
        clips={clips}
        clipOrder={session.clipOrder}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
      />

      <div className="my-6">
        <ClipRecorder autoSave hasExistingClip={session.clipOrder.length > 0} onClipReady={onClipReady} />
      </div>
    </div>
  );
}
