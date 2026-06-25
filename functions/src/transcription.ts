import { defineString } from 'firebase-functions/params';
import type { TranscriptionResult } from './types';

const transcriptionWorkerUrl = defineString('TRANSCRIPTION_WORKER_URL', {
  default: 'https://autobio-transcription-1012550333400.us-central1.run.app',
});

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 180_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureWorkerReady(workerUrl: string): Promise<void> {
  try {
    await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(60_000) });
  } catch {
    // Worker may still be loading the model — transcribe will retry.
  }
}

export async function transcribeAudio(
  audioUrl: string,
  languageHint: string,
  hindiOutputMode: string,
): Promise<TranscriptionResult> {
  const workerUrl = transcriptionWorkerUrl.value().replace(/\/$/, '');
  await ensureWorkerReady(workerUrl);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${workerUrl}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          language_hint: languageHint,
          hindi_output_mode: hindiOutputMode,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text();
        const err = new Error(`Transcription failed (${response.status}): ${body}`);
        if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
          lastError = err;
          await sleep(2000 * (attempt + 1));
          continue;
        }
        throw err;
      }

      const data = (await response.json()) as {
        text: string;
        language: string;
        detected_language: string;
        english_translation?: string;
        confidence?: number;
      };

      return {
        text: sanitizeWhisperTranscript(data.text),
        language: inferTranscriptLanguage(data.text, data.language, languageHint),
        detectedLanguage: data.detected_language,
        englishTranslation: data.english_translation
          ? sanitizeWhisperTranscript(data.english_translation)
          : undefined,
        confidence: data.confidence,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout =
        lastError.name === 'TimeoutError' || lastError.name === 'AbortError';
      if ((isTimeout || attempt < MAX_ATTEMPTS - 1) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('Transcription failed');
}

function normalizeLanguage(lang: string): 'en' | 'hi' | 'mixed' {
  if (lang === 'hi' || lang.startsWith('hi')) return 'hi';
  if (lang === 'en' || lang.startsWith('en')) return 'en';
  return 'mixed';
}

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const LATIN_RE = /[A-Za-z]/;

function inferTranscriptLanguage(
  text: string,
  detected: string,
  hint: string,
): 'en' | 'hi' | 'mixed' {
  const hasDev = DEVANAGARI_RE.test(text);
  const hasLatin = LATIN_RE.test(text);
  if (hasDev && hasLatin) return 'mixed';
  if (hasDev) return 'hi';
  if (hasLatin) return 'en';
  if (hint === 'mixed') return 'mixed';
  return normalizeLanguage(detected || hint);
}

/** Whisper echoes Hindi initial_prompt text on short clips — strip known leakage. */
export function sanitizeWhisperTranscript(text: string): string {
  if (!text.trim()) return text;
  let cleaned = text.trim();
  const patterns = [
    /यह\s+हिंदी\s+भाषा\s+में\s+बोला\s+गया\s+है[।.]?\s*/gu,
    /देवनागरी\s+लिपि\s+में\s+लिखें[।.]?\s*/gu,
    /(?:भाषा\s+में\s*)+लिखें[।.]?\s*/gu,
    /में\s+भाषा\s+में\s*/gu,
  ];
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim().replace(/^[.,;।\s]+|[.,;।\s]+$/g, '');
}
