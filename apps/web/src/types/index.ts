export type TranscriptLanguage = 'en' | 'hi' | 'mixed';
export type StoryPerspective = 'first' | 'third';
export type StoryStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type RecordingStatus = 'uploading' | 'transcribing' | 'generating' | 'ready' | 'error';
export type BookInvitationStatus = 'pending' | 'accepted' | 'revoked';
export type BookStoryStatus = 'draft' | 'submitted';
export type PromptType = 'text' | 'image';

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
  bookId?: string;
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
  bookId?: string;
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

export interface Book {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  activeShareToken?: string;
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BookInvitation {
  id: string;
  token: string;
  bookId: string;
  bookTitle: string;
  inviterId: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeUid?: string;
  status: BookInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
}

export interface BookStory {
  id: string;
  bookId: string;
  title: string;
  content: string;
  imageUrl?: string;
  status: BookStoryStatus;
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookAudioClip {
  id: string;
  bookId: string;
  promptType: PromptType;
  promptText: string;
  imageUrl?: string;
  audioUrl: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface PublicBookSnapshot {
  id: string;
  bookId: string;
  bookTitle: string;
  description?: string;
  shareToken: string;
  stories: Array<{
    id: string;
    title: string;
    content: string;
    imageUrl?: string;
    authorName: string;
    createdAt: string;
  }>;
  updatedAt: Date;
}
