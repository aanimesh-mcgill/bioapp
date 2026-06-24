import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AUTOBIOGRAPHY_STIMULI, getNextStimulus, bilingualStimulusPrompt } from '@/data/stimuli';
import { createStorySession } from '@/services/storySessions';
import { BilingualLine, PageHeading } from '@/components/BilingualText';
import type { Stimulus } from '@/types';

export function StimuliPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const completed = profile?.stimulusProgress?.completedStimulusIds ?? [];
  const next = getNextStimulus(completed);

  const startStimulus = async (stimulus: Stimulus) => {
    if (!user) return;
    const sessionId = await createStorySession({
      userId: user.uid,
      title: `${stimulus.titleEn} / ${stimulus.titleHi}`,
      sourceType: 'stimulus',
      stimulusId: stimulus.id,
      stimulusPrompt: bilingualStimulusPrompt(stimulus),
      languageHint: profile?.preferences.defaultLanguage ?? 'mixed',
      hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
      perspective: profile?.preferences.storyPerspective ?? 'first',
    });
    navigate(`/story/${sessionId}`);
  };

  return (
    <div className="px-4 py-6">
      <PageHeading en="Life Story Prompts" hi="जीवन कथा प्रश्न" />
      <div className="mb-6 mt-2">
        <p className="text-sm text-slate-600">
          Complete each prompt to build your autobiography. {completed.length} of{' '}
          {AUTOBIOGRAPHY_STIMULI.length} done.
        </p>
        <p className="font-hindi text-sm text-slate-500">
          अपनी आत्मकथा बनाने के लिए प्रत्येक प्रश्न पूरा करें। {completed.length} /{' '}
          {AUTOBIOGRAPHY_STIMULI.length} पूर्ण।
        </p>
      </div>

      {next && (
        <button
          type="button"
          className="card mb-6 w-full border-2 border-accent-400 bg-accent-50/30 text-left active:scale-[0.99] transition"
          onClick={() => startStimulus(next)}
        >
          <BilingualLine
            en="Up next"
            hi="अगला"
            enClass="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-600"
            hiClass="mb-2 text-xs font-semibold text-accent-500"
          />
          <BilingualLine
            en={next.titleEn}
            hi={next.titleHi}
            enClass="font-semibold text-brand-700"
            hiClass="text-sm text-slate-600"
          />
          <div className="mt-2">
            <p className="text-sm text-slate-700">{next.promptEn}</p>
            <p className="mt-1 font-hindi text-sm text-slate-600">{next.promptHi}</p>
          </div>
          <p className="btn-primary mt-4 w-full text-center pointer-events-none">
            Start This Prompt / इस प्रश्न से शुरू करें
          </p>
        </button>
      )}

      <div className="space-y-2">
        {AUTOBIOGRAPHY_STIMULI.map((s) => {
          const done = completed.includes(s.id);
          const isNext = next?.id === s.id;

          if (done) {
            return (
              <div key={s.id} className="card flex items-center gap-3 opacity-60">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <BilingualLine en={s.titleEn} hi={s.titleHi} enClass="font-medium text-slate-800" hiClass="text-sm text-slate-500" />
                  <BilingualLine en={s.category} hi={s.categoryHi} enClass="text-xs text-slate-500" hiClass="text-xs text-slate-400" />
                  <p className="mt-1 text-xs text-green-600">Completed / पूर्ण</p>
                </div>
              </div>
            );
          }

          return (
            <button
              key={s.id}
              type="button"
              className={`card flex w-full items-center gap-3 text-left active:scale-[0.99] transition ${
                isNext ? 'ring-2 ring-accent-300' : ''
              }`}
              onClick={() => startStimulus(s)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                {s.order}
              </span>
              <div className="min-w-0 flex-1">
                <BilingualLine en={s.titleEn} hi={s.titleHi} enClass="font-medium text-slate-800" hiClass="text-sm text-slate-500" />
                <BilingualLine en={s.category} hi={s.categoryHi} enClass="text-xs text-slate-500" hiClass="text-xs text-slate-400" />
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{s.promptEn}</p>
                <p className="font-hindi line-clamp-2 text-xs text-slate-500">{s.promptHi}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-brand-600">
                Start<br />
                <span className="font-hindi text-xs font-medium">शुरू</span>
              </span>
            </button>
          );
        })}
      </div>

      <Link to="/add-stimulus" className="btn-secondary mt-6 block w-full text-center">
        + Add Your Own (Text or Photo)
        <span className="font-hindi block text-sm font-normal">अपना खुद का जोड़ें (टेक्स्ट या फोटो)</span>
      </Link>
    </div>
  );
}
