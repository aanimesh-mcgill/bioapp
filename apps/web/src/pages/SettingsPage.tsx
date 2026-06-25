import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePickText } from '@/context/UiLocaleContext';
import { PageHeading, BilingualLine, BilingualBtn, SectionHeading, T } from '@/components/BilingualText';
import type { HindiOutputMode, StoryPerspective, TranscriptLanguage } from '@/types';

const LANGUAGE_OPTIONS: { value: TranscriptLanguage; en: string; hi: string }[] = [
  { value: 'en', en: 'English', hi: 'अंग्रेज़ी' },
  { value: 'hi', en: 'Hindi', hi: 'हिन्दी' },
  { value: 'mixed', en: 'Mixed Hindi-English', hi: 'मिश्रित हिन्दी-अंग्रेज़ी' },
];

const HINDI_OUTPUT_OPTIONS: { value: HindiOutputMode; en: string; hi: string }[] = [
  { value: 'hindi_script', en: 'Keep Hindi in Devanagari', hi: 'देवनागरी में रखें' },
  { value: 'translate_english', en: 'Translate Hindi to English', hi: 'अंग्रेज़ी में अनुवाद' },
  { value: 'clean_mixed', en: 'Clean mixed speech', hi: 'मिश्रित भाषा साफ़ करें' },
];

const PERSPECTIVE_OPTIONS: { value: StoryPerspective; en: string; hi: string }[] = [
  { value: 'first', en: 'First person (I, me, my)', hi: 'पहला व्यक्ति (मैं, मेरा)' },
  { value: 'third', en: 'Third person (he, she, they)', hi: 'तीसरा व्यक्ति (वह, वे)' },
];

export function SettingsPage() {
  const { profile, signOut, updatePreferences } = useAuth();
  const t = usePickText();
  const prefs = profile?.preferences;

  const [hindiOutputMode, setHindiOutputMode] = useState<HindiOutputMode>(
    prefs?.hindiOutputMode ?? 'hindi_script',
  );
  const [defaultLanguage, setDefaultLanguage] = useState<TranscriptLanguage>(
    prefs?.defaultLanguage ?? 'mixed',
  );
  const [storyPerspective, setStoryPerspective] = useState<StoryPerspective>(
    prefs?.storyPerspective ?? 'first',
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updatePreferences({ hindiOutputMode, defaultLanguage, storyPerspective });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-4 py-6">
      <PageHeading en="Settings" hi="सेटिंग्स" className="mb-6" />

      {profile && (
        <div className="card mb-6">
          <p className="font-semibold">{profile.displayName}</p>
          <p className="text-sm text-slate-500">{profile.email}</p>
          <p className="mt-1 text-xs capitalize text-brand-600">{profile.role}</p>
        </div>
      )}

      <section className="card mb-4 space-y-4">
        <SectionHeading en="Transcription Preferences" hi="प्रतिलेखन प्राथमिकताएँ" />

        <label className="block">
          <BilingualLine
            en="Default recording language"
            hi="डिफ़ॉल्ट रिकॉर्डिंग भाषा"
            enClass="text-sm font-medium text-slate-700"
            hiClass="text-xs text-slate-500"
          />
          <select
            className="input-field mt-1"
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value as TranscriptLanguage)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt)}
              </option>
            ))}
          </select>
          <BilingualLine
            en="Mixed auto-detects Hindi, English, or both in each recording. Use Hindi or English only if you always speak that language."
            hi="मिश्रित मोड हर रिकॉर्डिंग में हिन्दी, अंग्रेज़ी या दोनों पहचानता है। यदि हमेशा एक ही भाषा बोलें तो हिन्दी या अंग्रेज़ी चुनें।"
            enClass="mt-1 text-xs text-slate-500"
            hiClass="mt-1 text-xs text-slate-400"
          />
        </label>

        <label className="block">
          <BilingualLine
            en="Hindi output mode"
            hi="हिन्दी आउटपुट मोड"
            enClass="text-sm font-medium text-slate-700"
            hiClass="text-xs text-slate-500"
          />
          <select
            className="input-field mt-1"
            value={hindiOutputMode}
            onChange={(e) => setHindiOutputMode(e.target.value as HindiOutputMode)}
          >
            {HINDI_OUTPUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <BilingualLine
            en="Story perspective"
            hi="कहानी का दृष्टिकोण"
            enClass="text-sm font-medium text-slate-700"
            hiClass="text-xs text-slate-500"
          />
          <select
            className="input-field mt-1"
            value={storyPerspective}
            onChange={(e) => setStoryPerspective(e.target.value as StoryPerspective)}
          >
            {PERSPECTIVE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt)}
              </option>
            ))}
          </select>
        </label>

        <button className="btn-primary w-full" onClick={handleSave}>
          <BilingualBtn en="Save Preferences" hi="प्राथमिकताएँ सहेजें" />
        </button>
        {saved && (
          <p className="text-center text-sm text-green-600">
            <T en="Preferences saved!" hi="प्राथमिकताएँ सहेजी गईं!" />
          </p>
        )}
      </section>

      <button className="btn-secondary w-full border-red-300 text-red-600" onClick={signOut}>
        <BilingualBtn en="Sign Out" hi="साइन आउट" />
      </button>

      <section className="mt-8 space-y-2 text-center text-sm">
        <Link to="/about" className="block text-brand-600">
          <T en="About us" hi="हमारे बारे में" />
        </Link>
        <Link to="/terms" className="block text-brand-600">
          <T en="Terms & Conditions" hi="नियम और शर्तें" />
        </Link>
        <Link to="/privacy" className="block text-brand-600">
          <T en="Privacy Policy" hi="गोपनीयता नीति" />
        </Link>
      </section>
    </div>
  );
}
