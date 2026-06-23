export type TranscriptLanguage = 'en' | 'hi' | 'mixed';
export type StoryPerspective = 'first' | 'third';
export type HindiOutputMode = 'hindi_script' | 'translate_english' | 'clean_mixed';

export interface TranscriptionResult {
  text: string;
  language: TranscriptLanguage;
  detectedLanguage: string;
  englishTranslation?: string;
  confidence?: number;
}

export interface StoryGenerationInput {
  transcript: string;
  englishTranslation?: string;
  title: string;
  perspective: StoryPerspective;
  outputLanguage: 'en' | 'hi';
  hindiOutputMode: HindiOutputMode;
  languageHint: TranscriptLanguage;
}
