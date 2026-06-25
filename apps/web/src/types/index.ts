export type TranscriptLanguage = 'en' | 'hi' | 'mixed';
export type StoryPerspective = 'first' | 'third';
export type StoryStatus =
  | 'recording'
  | 'transcribing'
  | 'generating'
  | 'ready'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'error';
export type ClipStatus = 'uploading' | 'transcribing' | 'ready' | 'error';
export type HindiOutputMode = 'hindi_script' | 'translate_english' | 'clean_mixed';
export type StorySourceType = 'freeform' | 'stimulus' | 'text_stimulus' | 'image_stimulus' | 'composite';

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
  stimulusProgress?: StimulusProgress;
  bookId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StimulusProgress {
  completedStimulusIds: string[];
  currentIndex: number;
}

export interface Stimulus {
  id: string;
  order: number;
  titleEn: string;
  titleHi: string;
  promptEn: string;
  promptHi: string;
  category: string;
  categoryHi: string;
}

export type PromptSource = 'user' | 'system';

/** Book-scoped story prompt (stored under collabBooks/{bookId}/prompts). */
export interface BookPrompt {
  id: string;
  bookId: string;
  order: number;
  titleEn: string;
  titleHi: string;
  promptEn: string;
  promptHi: string;
  category: string;
  categoryHi: string;
  source: PromptSource;
  /** e.g. autobiography:earliest-memory when copied from a system template */
  systemTemplateId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookPromptProgress {
  completedPromptIds: string[];
  skippedPromptIds?: string[];
  skippedPhotoIds?: string[];
  skippedTurnIds?: string[];
  updatedAt: Date;
}

export type BookPhotoStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

/** Queued photo for a collab book — prompts one story at a time. */
export interface BookPhoto {
  id: string;
  bookId: string;
  imageUrl: string;
  imageStoragePath: string;
  date?: string;
  year?: number;
  status: BookPhotoStatus;
  storySessionId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImagePromptEntry {
  draftText?: string;
  finalText?: string;
  clipOrder?: string[];
  /** User chose to skip this prompt for now */
  skipped?: boolean;
}

export interface ImagePromptAnswers {
  whereTaken?: ImagePromptEntry;
  whoInPhoto?: ImagePromptEntry;
  event?: ImagePromptEntry;
  interesting?: ImagePromptEntry;
  beforeAfter?: ImagePromptEntry;
  relevance?: ImagePromptEntry;
}

export interface StoryTextBlock {
  id: string;
  type: 'text';
  content: string;
  date?: string;
  year?: number;
  clipOrder: string[];
}

export interface StoryImageBlock {
  id: string;
  type: 'image';
  title: string;
  imageUrl: string;
  imageStoragePath: string;
  date?: string;
  year?: number;
  prompts: ImagePromptAnswers;
  /** Unified playback order for all clips on this photo */
  clipOrder?: string[];
}

export type StoryContentBlock = StoryTextBlock | StoryImageBlock;

export interface TextStimulusData {
  content: string;
  date?: string;
  year?: number;
}

export interface ImageStimulusData {
  title: string;
  imageUrl: string;
  imageStoragePath: string;
  date?: string;
  year?: number;
  prompts: ImagePromptAnswers;
}

export interface Transcript {
  text: string;
  language: TranscriptLanguage;
  detectedLanguage?: string;
  englishTranslation?: string;
  confidence?: number;
}

export interface StoryAttachment {
  id: string;
  type: 'image' | 'link' | 'video';
  url: string;
  title?: string;
  caption?: string;
  storagePath?: string;
  createdAt: Date;
}

export interface AudioClip {
  id: string;
  storySessionId: string;
  userId: string;
  order: number;
  /** When set, clip belongs to a story content block */
  blockId?: string;
  /** When set, clip belongs to an image prompt answer (not main story) */
  promptKey?: string;
  /** Display name — user-editable; defaults to "Clip N" in UI when empty */
  label?: string;
  /** Fixed sequence number when clip was first added (does not change on reorder) */
  clipNumber?: number;
  storagePath: string;
  audioUrl?: string;
  durationSeconds?: number;
  status: ClipStatus;
  transcript?: Transcript;
  errorMessage?: string;
  createdAt: Date;
}

export interface StorySession {
  id: string;
  userId: string;
  bookId?: string;
  /** Collab book this story belongs to (for prompts, photos, etc.). */
  collabBookId?: string;
  bookOwnerId?: string;
  chapterId?: string;
  chapterOrder?: number;
  publicSlug?: string;
  title: string;
  sourceType: StorySourceType;
  stimulusId?: string;
  stimulusPrompt?: string;
  textStimulus?: TextStimulusData;
  imageStimulus?: ImageStimulusData;
  /** Ordered content blocks (photos, text prompts, etc.) */
  contentBlockOrder?: string[];
  contentBlocks?: Record<string, StoryContentBlock>;
  clipOrder: string[];
  languageHint: TranscriptLanguage;
  hindiOutputMode: HindiOutputMode;
  status: StoryStatus;
  combinedTranscript?: Transcript;
  editedTranscript?: string;
  draft?: string;
  editedDraft?: string;
  attachments?: StoryAttachment[];
  perspective: StoryPerspective;
  outputLanguage: 'en' | 'hi';
  buyerNotes?: string;
  errorMessage?: string;
  isContributorStory?: boolean;
  contributorInviteId?: string;
  contributorName?: string;
  contributorRelationship?: string;
  /** Set when contributor taps Submit — locks further edits by contributor. */
  contributorSubmitted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContributorInvite {
  id: string;
  bookId: string;
  ownerId: string;
  ownerName: string;
  bookTitle: string;
  contributorName: string;
  relationship: string;
  inviteSlug: string;
  isActive: boolean;
  contributorUserId?: string;
  createdAt: Date;
}

export interface Book {
  id: string;
  userId: string;
  /** Links this published album to a collabBooks entry when set. */
  collabBookId?: string;
  title: string;
  authorName: string;
  publicSlug: string;
  isPublished: boolean;
  chapterOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  bookId: string;
  userId: string;
  title: string;
  order: number;
  storyOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BookPage {
  type: 'cover' | 'toc' | 'chapter-title' | 'story';
  chapterId?: string;
  chapterTitle?: string;
  storyId?: string;
  story?: StorySession;
}

/** Multi-book author model for managed books; collaborator access is optional. */
export type BookInvitationStatus = 'pending' | 'accepted' | 'revoked';
export type BookStoryStatus = 'draft' | 'submitted';
export type PromptType = 'text' | 'image';

export interface AuthorBook {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  activeShareToken?: string;
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Collab / multi-book model (`collabBooks` collection). */
export type CollabBook = AuthorBook;

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
  /** Album book used for live browse view */
  albumBookId?: string;
  bookTitle: string;
  description?: string;
  shareToken: string;
  stories: Array<{
    id: string;
    title: string;
    content: string;
    imageUrl?: string;
    imageUrls?: string[];
    authorName: string;
    chapterTitle?: string;
    createdAt: string;
  }>;
  audioClips: Array<{
    id: string;
    promptType: PromptType;
    promptText: string;
    imageUrl?: string;
    audioUrl: string;
    createdByName: string;
    createdAt: string;
  }>;
  chapters?: Array<{
    id: string;
    title: string;
    storyIds: string[];
  }>;
  updatedAt: Date;
}

// Legacy types
export type RecordingStatus = ClipStatus | 'generating' | 'ready';
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
