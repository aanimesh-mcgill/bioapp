import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { transcribeAudio } from './transcription';
import { generateStoryDraft } from './storyLlm';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();

interface RecordingDoc {
  userId: string;
  bookId?: string;
  title: string;
  languageHint?: string;
  hindiOutputMode?: string;
  status: string;
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

    const match = filePath.match(/^recordings\/([^/]+)\/([^/]+)\//);
    if (!match) return;

    const [, userId, recordingId] = match;
    const recordingRef = db.collection('recordings').doc(recordingId);
    const recordingSnap = await recordingRef.get();

    if (!recordingSnap.exists) {
      console.warn(`Recording doc not found: ${recordingId}`);
      return;
    }

    const recording = recordingSnap.data() as RecordingDoc;
    if (recording.status === 'ready') return;

    try {
      await recordingRef.update({
        status: 'transcribing',
        updatedAt: FieldValue.serverTimestamp(),
      });

      const bucket = getStorage().bucket(event.data.bucket);
      const file = bucket.file(filePath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000,
      });

      const transcript = await transcribeAudio(
        signedUrl,
        recording.languageHint ?? 'mixed',
        recording.hindiOutputMode ?? 'hindi_script',
      );

      await recordingRef.update({
        status: 'generating',
        updatedAt: FieldValue.serverTimestamp(),
      });

      const userSnap = await db.collection('users').doc(userId).get();
      const prefs = userSnap.data()?.preferences ?? {};

      const outputLanguage =
        recording.hindiOutputMode === 'translate_english' ? 'en' : transcript.language === 'hi' ? 'hi' : 'en';

      const draft = await generateStoryDraft({
        transcript: transcript.text,
        englishTranslation: transcript.englishTranslation,
        title: recording.title,
        perspective: prefs.storyPerspective ?? 'first',
        outputLanguage: outputLanguage === 'hi' ? 'hi' : 'en',
        hindiOutputMode: (recording.hindiOutputMode ?? 'hindi_script') as 'hindi_script' | 'translate_english' | 'clean_mixed',
        languageHint: (recording.languageHint ?? 'mixed') as 'en' | 'hi' | 'mixed',
      });

      await db.collection('stories').add({
        recordingId,
        userId,
        bookId: recording.bookId ?? '',
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

      await recordingRef.update({
        status: 'ready',
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('Processing failed:', err);
      await recordingRef.update({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Processing failed',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);
