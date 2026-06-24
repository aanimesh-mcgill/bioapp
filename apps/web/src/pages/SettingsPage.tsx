import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PageHeading, BilingualLine, BilingualBtn, SectionHeading } from '@/components/BilingualText';
import type { HindiOutputMode, StoryPerspective, TranscriptLanguage } from '@/types';

export function SettingsPage() {
  const { profile, signOut, updatePreferences } = useAuth();
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
            <option value="en">English / अंग्रेज़ी</option>
            <option value="hi">Hindi / हिन्दी</option>
            <option value="mixed">Mixed Hindi-English / मिश्रित हिन्दी-अंग्रेज़ी</option>
          </select>
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
            <option value="hindi_script">Keep Hindi in Devanagari / देवनागरी में रखें</option>
            <option value="translate_english">Translate Hindi to English / अंग्रेज़ी में अनुवाद</option>
            <option value="clean_mixed">Clean mixed speech / मिश्रित भाषा साफ़ करें</option>
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
            <option value="first">First person (I, me, my) / पहला व्यक्ति (मैं, मेरा)</option>
            <option value="third">Third person (he, she, they) / तीसरा व्यक्ति (वह, वे)</option>
          </select>
        </label>

        <button className="btn-primary w-full" onClick={handleSave}>
          <BilingualBtn en="Save Preferences" hi="प्राथमिकताएँ सहेजें" />
        </button>
        {saved && (
          <p className="text-center text-sm text-green-600">
            Preferences saved! / प्राथमिकताएँ सहेजी गईं!
          </p>
        )}
      </section>

      <button className="btn-secondary w-full border-red-300 text-red-600" onClick={signOut}>
        <BilingualBtn en="Sign Out" hi="साइन आउट" />
      </button>
    </div>
  );
}
