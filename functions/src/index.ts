import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { auth as authV1 } from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { transcribeAudio } from './transcription';
import { generateStoryDraft } from './storyLlm';
import type { HindiOutputMode, StoryPerspective, TranscriptLanguage } from './types';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();

function clipProcessingError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Processing failed';
  if (raw.includes('503') || raw.toLowerCase().includes('service unavailable')) {
    return 'Transcription service unavailable — tap Retry transcription.';
  }
  if (raw.includes('502') || raw.includes('504') || raw.toLowerCase().includes('timeout')) {
    return 'Transcription timed out — tap Retry transcription.';
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}

interface SessionDoc {
  userId: string;
  bookId?: string;
  title: string;
  languageHint?: string;
  hindiOutputMode?: string;
  status: string;
  readyToGenerate?: boolean;
  clipOrder?: string[];
  stimulusPrompt?: string;
  textStimulus?: { content: string; date?: string; year?: number };
  imageStimulus?: {
    title: string;
    date?: string;
    year?: number;
    prompts?: Record<string, string | { draftText?: string; finalText?: string; clipOrder?: string[] }>;
  };
  contentBlockOrder?: string[];
  contentBlocks?: Record<
    string,
    {
      id: string;
      type: 'text' | 'image';
      content?: string;
      title?: string;
      date?: string;
      year?: number;
      prompts?: Record<string, string | { draftText?: string; finalText?: string; clipOrder?: string[] }>;
    }
  >;
  perspective?: string;
  isContributorStory?: boolean;
}

interface ClipDoc {
  userId: string;
  storySessionId: string;
  status: string;
  order: number;
  promptKey?: string;
  blockId?: string;
  storagePath?: string;
  purpose?: string;
}

function promptEntryText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const entry = val as { finalText?: string; draftText?: string };
    return entry.finalText?.trim() || entry.draftText?.trim() || '';
  }
  return '';
}

async function appendPromptTranscript(
  sessionId: string,
  promptKey: string,
  transcriptText: string,
  blockId?: string,
): Promise<void> {
  if (!transcriptText.trim()) return;
  const sessionRef = db.collection('storySessions').doc(sessionId);
  const snap = await sessionRef.get();
  const data = snap.data() as SessionDoc | undefined;
  if (!data) return;

  const contentBlocks = data.contentBlocks ? { ...data.contentBlocks } : undefined;

  if (blockId && contentBlocks?.[blockId]?.type === 'image') {
    const block = { ...contentBlocks[blockId] };
    const prompts = { ...(block.prompts ?? {}) };
    const existing = prompts[promptKey];
    let draftText = '';
    let finalText = '';
    let clipOrder: string[] = [];

    if (typeof existing === 'string') {
      draftText = existing;
    } else if (existing && typeof existing === 'object') {
      draftText = existing.draftText ?? '';
      finalText = existing.finalText ?? '';
      clipOrder = existing.clipOrder ?? [];
    }

    const separator = draftText.trim() ? '\n\n' : '';
    draftText = `${draftText}${separator}${transcriptText}`.trim();
    prompts[promptKey] = { draftText, finalText, clipOrder };
    contentBlocks[blockId] = { ...block, prompts };

    const readerParts: string[] = [];
    for (const id of data.contentBlockOrder ?? Object.keys(contentBlocks)) {
      const b = contentBlocks[id];
      if (!b) continue;
      if (b.type === 'text' && b.content?.trim()) readerParts.push(b.content.trim());
      if (b.type === 'image' && b.prompts) {
        for (const [, val] of Object.entries(b.prompts)) {
          const text = promptEntryText(val);
          if (text) readerParts.push(text);
        }
      }
    }

    await sessionRef.update({
      contentBlocks,
      editedDraft: readerParts.length ? readerParts.join('\n\n') : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const imageStimulus = data.imageStimulus;
  if (!imageStimulus?.prompts) return;

  const prompts = { ...imageStimulus.prompts };
  const existing = prompts[promptKey];
  let draftText = '';
  let finalText = '';
  let clipOrder: string[] = [];

  if (typeof existing === 'string') {
    draftText = existing;
  } else if (existing && typeof existing === 'object') {
    draftText = existing.draftText ?? '';
    finalText = existing.finalText ?? '';
    clipOrder = existing.clipOrder ?? [];
  }

  const separator = draftText.trim() ? '\n\n' : '';
  draftText = `${draftText}${separator}${transcriptText}`.trim();

  prompts[promptKey] = { draftText, finalText, clipOrder };

  const readerParts: string[] = [];
  for (const [, val] of Object.entries(prompts)) {
    const text = promptEntryText(val);
    if (text) readerParts.push(text);
  }

  await sessionRef.update({
    'imageStimulus.prompts': prompts,
    editedDraft: readerParts.length ? readerParts.join('\n\n') : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function getReadableAudioUrl(
  bucket: string,
  filePath: string,
  docRef?: DocumentReference,
): Promise<string> {
  if (docRef) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = await docRef.get();
      const audioUrl = snap.data()?.audioUrl as string | undefined;
      if (audioUrl) return audioUrl;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  const file = getStorage().bucket(bucket).file(filePath);
  const [metadata] = await file.getMetadata();
  const rawToken = metadata.metadata?.firebaseStorageDownloadTokens;
  const token = typeof rawToken === 'string' ? rawToken.split(',')[0] : undefined;
  if (token) {
    const encoded = encodeURIComponent(filePath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media&token=${token}`;
  }

  throw new Error('Could not resolve audio download URL for transcription');
}

function buildStimulusContext(session: SessionDoc): string {
  const parts: string[] = [];
  if (session.stimulusPrompt) parts.push(`Prompt: ${session.stimulusPrompt}`);

  if (session.contentBlockOrder?.length && session.contentBlocks) {
    for (const id of session.contentBlockOrder) {
      const block = session.contentBlocks[id];
      if (!block) continue;
      if (block.type === 'text') {
        parts.push(`Text note: ${block.content ?? ''}`);
        if (block.date) parts.push(`Date: ${block.date}`);
        if (block.year) parts.push(`Year: ${block.year}`);
      } else if (block.type === 'image') {
        parts.push(`Photo: ${block.title ?? ''}`);
        if (block.date) parts.push(`Date: ${block.date}`);
        if (block.year) parts.push(`Year: ${block.year}`);
        if (block.prompts) {
          for (const [key, val] of Object.entries(block.prompts)) {
            const text = promptEntryText(val);
            if (text) parts.push(`${key}: ${text}`);
          }
        }
      }
    }
    return parts.join('\n');
  }

  if (session.textStimulus) {
    parts.push(`Text note: ${session.textStimulus.content}`);
    if (session.textStimulus.date) parts.push(`Date: ${session.textStimulus.date}`);
    if (session.textStimulus.year) parts.push(`Year: ${session.textStimulus.year}`);
  }
  if (session.imageStimulus) {
    parts.push(`Photo: ${session.imageStimulus.title}`);
    if (session.imageStimulus.date) parts.push(`Date: ${session.imageStimulus.date}`);
    if (session.imageStimulus.year) parts.push(`Year: ${session.imageStimulus.year}`);
    if (session.imageStimulus.prompts) {
      for (const [key, val] of Object.entries(session.imageStimulus.prompts)) {
        const text = promptEntryText(val);
        if (text) parts.push(`${key}: ${text}`);
      }
    }
  }
  return parts.join('\n');
}

async function maybeGenerateStory(sessionId: string): Promise<void> {
  const sessionRef = db.collection('storySessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) return;

  const session = sessionSnap.data() as SessionDoc;
  if (!session.readyToGenerate) return;
  if (['ready', 'pending_approval', 'approved', 'generating'].includes(session.status)) return;

  const clipOrder = session.clipOrder ?? [];
  if (clipOrder.length === 0) return;

  const clipSnaps = await Promise.all(
    clipOrder.map((id) => db.collection('clips').doc(id).get()),
  );

  const clips = clipSnaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...(s.data() as ClipDoc & { transcript?: { text: string; englishTranslation?: string; language?: string } }) }));

  if (clips.some((c) => c.status !== 'ready')) return;

  await sessionRef.update({ status: 'generating', updatedAt: FieldValue.serverTimestamp() });

  try {
    const combinedText = clips.map((c) => c.transcript?.text ?? '').filter(Boolean).join('\n\n');
    const translations = clips
      .map((c) => c.transcript?.englishTranslation)
      .filter(Boolean)
      .join('\n\n');

    const userSnap = await db.collection('users').doc(session.userId).get();
    const prefs = userSnap.data()?.preferences ?? {};

    const primaryLang = clips[0]?.transcript?.language ?? session.languageHint ?? 'mixed';
    const outputLanguage =
      session.hindiOutputMode === 'translate_english'
        ? 'en'
        : primaryLang === 'hi'
          ? 'hi'
          : 'en';

    const draft = await generateStoryDraft({
      transcript: combinedText,
      englishTranslation: translations || undefined,
      title: session.title,
      perspective: (session.perspective ?? prefs.storyPerspective ?? 'first') as StoryPerspective,
      outputLanguage: outputLanguage === 'hi' ? 'hi' : 'en',
      hindiOutputMode: (session.hindiOutputMode ?? 'hindi_script') as HindiOutputMode,
      languageHint: (session.languageHint ?? 'mixed') as TranscriptLanguage,
      stimulusContext: buildStimulusContext(session),
    });

    await sessionRef.update({
      status: session.isContributorStory ? 'pending_approval' : 'approved',
      combinedTranscript: {
        text: combinedText,
        language: primaryLang,
        englishTranslation: translations || null,
      },
      draft,
      publicSlug: `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${sessionId.slice(0, 8)}`,
      outputLanguage: outputLanguage === 'hi' ? 'hi' : 'en',
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Story generation failed:', err);
    await sessionRef.update({
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Story generation failed',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

async function processClipUpload(
  bucket: string,
  filePath: string,
  userId: string,
  sessionId: string,
  clipId: string,
): Promise<void> {
  const clipRef = db.collection('clips').doc(clipId);
  const clipSnap = await clipRef.get();
  if (!clipSnap.exists) {
    console.warn(`Clip doc not found: ${clipId}`);
    return;
  }

  const clip = clipSnap.data() as ClipDoc;
  if (clip.status === 'ready') return;

  const sessionRef = db.collection('storySessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) return;
  const session = sessionSnap.data() as SessionDoc;

  try {
    await clipRef.update({ status: 'transcribing' });

    const audioUrl = await getReadableAudioUrl(bucket, filePath, clipRef);
    const transcript = await transcribeAudio(
      audioUrl,
      session.languageHint ?? 'mixed',
      session.hindiOutputMode ?? 'hindi_script',
    );

    await clipRef.update({
      status: 'ready',
      transcript: {
        text: transcript.text,
        language: transcript.language,
        detectedLanguage: transcript.detectedLanguage,
        englishTranslation: transcript.englishTranslation ?? null,
        confidence: transcript.confidence ?? null,
      },
    });

    if (clip.purpose === 'title') {
      return;
    }

    const clipData = clipSnap.data() as ClipDoc;
    if (clipData.promptKey) {
      await appendPromptTranscript(sessionId, clipData.promptKey, transcript.text, clipData.blockId);
      return;
    }

    await maybeGenerateStory(sessionId);
  } catch (err) {
    console.error('Clip processing failed:', err);
    await clipRef.update({
      status: 'error',
      errorMessage: clipProcessingError(err),
    });
  }
}

async function processLegacyRecording(
  bucket: string,
  filePath: string,
  userId: string,
  recordingId: string,
): Promise<void> {
  const recordingRef = db.collection('recordings').doc(recordingId);
  const recordingSnap = await recordingRef.get();
  if (!recordingSnap.exists) return;

  const recording = recordingSnap.data() as SessionDoc;
  if (recording.status === 'ready') return;

  try {
    await recordingRef.update({ status: 'transcribing', updatedAt: FieldValue.serverTimestamp() });

    const audioUrl = await getReadableAudioUrl(bucket, filePath, recordingRef);
    const transcript = await transcribeAudio(
      audioUrl,
      recording.languageHint ?? 'mixed',
      recording.hindiOutputMode ?? 'hindi_script',
    );

    await recordingRef.update({ status: 'generating', updatedAt: FieldValue.serverTimestamp() });

    const userSnap = await db.collection('users').doc(userId).get();
    const prefs = userSnap.data()?.preferences ?? {};
    const outputLanguage =
      recording.hindiOutputMode === 'translate_english'
        ? 'en'
        : transcript.language === 'hi'
          ? 'hi'
          : 'en';

    const draft = await generateStoryDraft({
      transcript: transcript.text,
      englishTranslation: transcript.englishTranslation,
      title: recording.title,
      perspective: (prefs.storyPerspective ?? 'first') as StoryPerspective,
      outputLanguage: outputLanguage === 'hi' ? 'hi' : 'en',
      hindiOutputMode: (recording.hindiOutputMode ?? 'hindi_script') as HindiOutputMode,
      languageHint: (recording.languageHint ?? 'mixed') as TranscriptLanguage,
    });

    await db.collection('stories').add({
      recordingId,
      userId,
      title: recording.title,
      transcript: {
        text: transcript.text,
        language: transcript.language,
        detectedLanguage: transcript.detectedLanguage,
        englishTranslation: transcript.englishTranslation ?? null,
        confidence: transcript.confidence ?? null,
      },
      draft,
      editedDraft: null,
      perspective: prefs.storyPerspective ?? 'first',
      outputLanguage: outputLanguage === 'hi' ? 'hi' : 'en',
      status: 'pending_approval',
      buyerNotes: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await recordingRef.update({ status: 'ready', updatedAt: FieldValue.serverTimestamp() });
  } catch (err) {
    console.error('Legacy recording failed:', err);
    await recordingRef.update({
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Processing failed',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export const processRecordingUpload = onObjectFinalized(
  {
    bucket: 'autobio-b5dbf.firebasestorage.app',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (event) => {
    const filePath = event.data.name;
    if (!filePath) return;

    const clipMatch = filePath.match(/^stories\/([^/]+)\/([^/]+)\/clips\/([^/]+)\//);
    if (clipMatch) {
      const [, userId, sessionId, clipId] = clipMatch;
      await processClipUpload(event.data.bucket, filePath, userId, sessionId, clipId);
      return;
    }

    const legacyMatch = filePath.match(/^recordings\/([^/]+)\/([^/]+)\//);
    if (legacyMatch) {
      const [, userId, recordingId] = legacyMatch;
      await processLegacyRecording(event.data.bucket, filePath, userId, recordingId);
    }
  },
);

const defaultUserPreferences = {
  hindiOutputMode: 'hindi_script',
  defaultLanguage: 'mixed',
  storyPerspective: 'first',
};

/** Create Firestore profile for every new Auth user (email or Google). */
export const onAuthUserCreated = authV1.user().onCreate(async (user) => {
  const ref = db.collection('users').doc(user.uid);
  const existing = await ref.get();
  if (existing.exists) return;

  const displayName =
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    '';

  const profile: Record<string, unknown> = {
    uid: user.uid,
    email: user.email ?? '',
    displayName,
    role: 'storyteller',
    preferences: defaultUserPreferences,
    stimulusProgress: { completedStimulusIds: [], currentIndex: 0 },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (user.photoURL) {
    profile.photoURL = user.photoURL;
  }

  await ref.set(profile);
});

/** Backfill / repair Firestore profile for signed-in users (Admin SDK). */
export const syncMyUserProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const authUser = await getAuth().getUser(request.auth.uid);
  const ref = db.collection('users').doc(authUser.uid);
  const existing = await ref.get();

  const displayName =
    authUser.displayName?.trim() ||
    authUser.email?.split('@')[0] ||
    '';

  const profile: Record<string, unknown> = {
    uid: authUser.uid,
    email: authUser.email ?? '',
    displayName: existing.exists
      ? (existing.data()?.displayName as string | undefined)?.trim() || displayName
      : displayName,
    role: existing.data()?.role ?? 'storyteller',
    preferences: existing.data()?.preferences ?? defaultUserPreferences,
    stimulusProgress: existing.data()?.stimulusProgress ?? {
      completedStimulusIds: [],
      currentIndex: 0,
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (authUser.photoURL) {
    profile.photoURL = authUser.photoURL;
  }

  if (!existing.exists) {
    profile.createdAt = FieldValue.serverTimestamp();
  }

  await ref.set(profile, { merge: true });
  return { ok: true, created: !existing.exists };
});

/** Re-run transcription for a clip that failed (e.g. worker outage). */
export const retryClipTranscription = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const clipId = request.data?.clipId as string | undefined;
  if (!clipId) {
    throw new HttpsError('invalid-argument', 'clipId is required');
  }

  const clipRef = db.collection('clips').doc(clipId);
  const clipSnap = await clipRef.get();
  if (!clipSnap.exists) {
    throw new HttpsError('not-found', 'Clip not found');
  }

  const clip = clipSnap.data() as ClipDoc;
  if (clip.userId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Not your clip');
  }

  const storagePath = clip.storagePath;
  if (!storagePath) {
    throw new HttpsError('failed-precondition', 'Clip has no audio file yet');
  }

  await clipRef.update({
    status: 'transcribing',
    errorMessage: FieldValue.delete(),
  });

  await processClipUpload(
    'autobio-b5dbf.firebasestorage.app',
    storagePath,
    clip.userId,
    clip.storySessionId,
    clipId,
  );

  const updated = await clipRef.get();
  return {
    ok: true,
    status: updated.data()?.status,
    transcript: updated.data()?.transcript?.text ?? null,
  };
});
