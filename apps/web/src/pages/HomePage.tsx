import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageHeading, BilingualLine } from '@/components/BilingualText';
import { AppLogo } from '@/components/AppLogo';
import { getNextStimulus, AUTOBIOGRAPHY_STIMULI, bilingualStimulusPrompt } from '@/data/stimuli';
import { createStorySession } from '@/services/storySessions';

export function HomePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const name = profile?.displayName?.split(' ')[0] ?? 'there';
  const completed = profile?.stimulusProgress?.completedStimulusIds ?? [];
  const next = getNextStimulus(completed);

  const startNextPrompt = async () => {
    if (!user || !next) return;
    const sessionId = await createStorySession({
      userId: user.uid,
      title: `${next.titleEn} / ${next.titleHi}`,
      sourceType: 'stimulus',
      stimulusId: next.id,
      stimulusPrompt: bilingualStimulusPrompt(next),
      languageHint: profile?.preferences.defaultLanguage ?? 'mixed',
      hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
      perspective: profile?.preferences.storyPerspective ?? 'first',
    });
    navigate(`/story/${sessionId}`);
  };

  return (
    <div className="px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <AppLogo className="mb-3 h-12 w-auto max-w-[220px] object-contain" />
          <PageHeading en={`Hi, ${name}`} hi={`नमस्ते, ${name}`} />
        </div>
        <Link to="/settings" className="shrink-0 pt-1 text-sm text-slate-500">
          Settings / सेटिंग्स
        </Link>
      </header>

      {next && (
        <div className="card mb-4 border-l-4 border-l-accent-400">
          <p className="text-xs font-semibold uppercase text-accent-600">
            Next prompt · {completed.length}/{AUTOBIOGRAPHY_STIMULI.length} done
          </p>
          <p className="font-hindi text-xs text-accent-500">
            अगला प्रश्न · {completed.length}/{AUTOBIOGRAPHY_STIMULI.length} पूर्ण
          </p>
          <h2 className="mt-1 font-semibold text-brand-700">{next.titleEn}</h2>
          <p className="font-hindi text-sm font-medium text-brand-600">{next.titleHi}</p>
          <p className="mt-1 text-sm text-slate-600 line-clamp-2">{next.promptEn}</p>
          <p className="font-hindi mt-1 text-sm text-slate-500 line-clamp-2">{next.promptHi}</p>
          <button type="button" className="btn-primary mt-3 w-full" onClick={startNextPrompt}>
            Start This Prompt / इस प्रश्न से शुरू करें
          </button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Link to="/record" className="card flex flex-col items-center gap-2 py-4 active:scale-[0.98]">
          <span className="text-3xl">🎙️</span>
          <BilingualLine en="Free Record" hi="मुक्त रिकॉर्ड" enClass="text-sm font-semibold text-brand-600" hiClass="text-xs text-brand-500" />
        </Link>
        <Link to="/add-stimulus" className="card flex flex-col items-center gap-2 py-4 active:scale-[0.98]">
          <span className="text-3xl">📷</span>
          <BilingualLine en="Add Photo/Text" hi="फोटो/टेक्स्ट जोड़ें" enClass="text-sm font-semibold text-brand-600" hiClass="text-xs text-brand-500" />
        </Link>
      </div>

      <Link to="/prompts" className="btn-secondary mb-6 block w-full text-center">
        View All Life Story Prompts
        <span className="font-hindi block text-sm font-normal">सभी जीवन कथा प्रश्न देखें</span>
      </Link>

      <div className="space-y-2">
        <BilingualLine
          en="How it works"
          hi="यह कैसे काम करता है"
          enClass="text-sm font-semibold uppercase tracking-wide text-slate-500"
          hiClass="text-xs text-slate-400"
        />
        {[
          ['Answer prompts or add your own photo/text stimulus', 'प्रश्नों के उत्तर दें या अपनी फोटो/टेक्स्ट जोड़ें'],
          ['Record multiple short clips — transcribe in background', 'कई छोटे क्लिप रिकॉर्ड करें — पृष्ठभूमि में प्रतिलेखन'],
          ['Reorder clips, then generate your story draft', 'क्लिप क्रम बदलें, फिर कहानी ड्राफ्ट बनाएं'],
          ['Edit and approve when ready', 'तैयार होने पर संपादित करें और स्वीकृत करें'],
        ].map(([text, textHi], i) => (
          <div key={i} className="card flex items-start gap-3 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
              {i + 1}
            </span>
            <div>
              <p className="pt-0.5 text-sm text-slate-700">{text}</p>
              <p className="font-hindi text-xs text-slate-500">{textHi}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
