import { defineString } from 'firebase-functions/params';
import type { TranscriptionResult } from './types';

const transcriptionWorkerUrl = defineString('TRANSCRIPTION_WORKER_URL', {
  default: 'http://localhost:8080',
});

export async function transcribeAudio(
  audioUrl: string,
  languageHint: string,
  hindiOutputMode: string,
): Promise<TranscriptionResult> {
  const workerUrl = transcriptionWorkerUrl.value();
  const response = await fetch(`${workerUrl}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_hint: languageHint,
      hindi_output_mode: hindiOutputMode,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    text: string;
    language: string;
    detected_language: string;
    english_translation?: string;
    confidence?: number;
  };

  return {
    text: data.text,
    language: normalizeLanguage(data.language),
    detectedLanguage: data.detected_language,
    englishTranslation: data.english_translation,
    confidence: data.confidence,
  };
}

function normalizeLanguage(lang: string): 'en' | 'hi' | 'mixed' {
  if (lang === 'hi' || lang.startsWith('hi')) return 'hi';
  if (lang === 'en' || lang.startsWith('en')) return 'en';
  return 'mixed';
}
