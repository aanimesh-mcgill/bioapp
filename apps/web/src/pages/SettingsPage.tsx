import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
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
      <h1 className="mb-6 text-2xl font-bold text-brand-600">Settings</h1>

      {profile && (
        <div className="card mb-6">
          <p className="font-semibold">{profile.displayName}</p>
          <p className="text-sm text-slate-500">{profile.email}</p>
          <p className="mt-1 text-xs capitalize text-brand-600">{profile.role}</p>
        </div>
      )}

      <section className="card mb-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Transcription Preferences
        </h2>

        <label className="block text-sm font-medium text-slate-700">
          Default recording language
          <select
            className="input-field mt-1"
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value as TranscriptLanguage)}
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="mixed">Mixed Hindi-English</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Hindi output mode
          <select
            className="input-field mt-1"
            value={hindiOutputMode}
            onChange={(e) => setHindiOutputMode(e.target.value as HindiOutputMode)}
          >
            <option value="hindi_script">Keep Hindi in Devanagari script</option>
            <option value="translate_english">Translate Hindi to English</option>
            <option value="clean_mixed">Clean mixed Hindi-English speech</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Story perspective
          <select
            className="input-field mt-1"
            value={storyPerspective}
            onChange={(e) => setStoryPerspective(e.target.value as StoryPerspective)}
          >
            <option value="first">First person (I, me, my)</option>
            <option value="third">Third person (he, she, they)</option>
          </select>
        </label>

        <button className="btn-primary w-full" onClick={handleSave}>
          Save Preferences
        </button>
        {saved && <p className="text-center text-sm text-green-600">Preferences saved!</p>}
      </section>

      <button className="btn-secondary w-full text-red-600 border-red-300" onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}
