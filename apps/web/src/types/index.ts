export type TranscriptLanguage = 'en' | 'hi' | 'mixed';
export type StoryPerspective = 'first' | 'third';
export type StoryStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type RecordingStatus = 'uploading' | 'transcribing' | 'generating' | 'ready' | 'error';

export type HindiOutputMode = 'hindi_script' | 'translate_english' | 'clean_mixed';

export interface UserPreferences {
  hindiOutputMode: HindiOutputMode;
  defaultLanguage: TranscriptLanguage;
  storyPerspective: StoryPerspective;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'storyteller' | 'buyer' | 'admin';
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recording {
  id: string;
  userId: string;
  buyerId?: string;
  title: string;
  storagePath: string;
  audioUrl?: string;
  durationSeconds?: number;
  languageHint?: TranscriptLanguage;
  hindiOutputMode: HindiOutputMode;
  status: RecordingStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transcript {
  text: string;
  language: TranscriptLanguage;
  detectedLanguage?: string;
  englishTranslation?: string;
  confidence?: number;
}

export interface Story {
  id: string;
  recordingId: string;
  userId: string;
  buyerId?: string;
  title: string;
  transcript: Transcript;
  draft: string;
  editedDraft?: string;
  perspective: StoryPerspective;
  outputLanguage: 'en' | 'hi';
  status: StoryStatus;
  buyerNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
