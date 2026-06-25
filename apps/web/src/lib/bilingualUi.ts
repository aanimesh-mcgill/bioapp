import type { UiLocale } from '@/lib/locale';
import { pickText } from '@/lib/locale';

export const SESSION_STATUS: Record<string, { en: string; hi: string }> = {
  recording: { en: 'Recording', hi: 'रिकॉर्डिंग' },
  transcribing: { en: 'Transcribing…', hi: 'प्रतिलेखन…' },
  generating: { en: 'Writing story…', hi: 'कहानी लिखी जा रही…' },
  ready: { en: 'Draft ready', hi: 'ड्राफ्ट तैयार' },
  pending_approval: { en: 'Ready to approve', hi: 'स्वीकृति के लिए तैयार' },
  approved: { en: 'Approved', hi: 'स्वीकृत' },
  rejected: { en: 'Needs revision', hi: 'संशोधन चाहिए' },
  error: { en: 'Error', hi: 'त्रुटि' },
};

export const CLIP_STATUS: Record<string, { en: string; hi: string }> = {
  uploading: { en: 'Uploading…', hi: 'अपलोड…' },
  transcribing: { en: 'Transcribing…', hi: 'प्रतिलेखन…' },
  ready: { en: 'Transcribed', hi: 'प्रतिलेखित' },
  error: { en: 'Transcription failed', hi: 'प्रतिलेखन विफल' },
};

export function isClipRemoved(clip: { errorMessage?: string }): boolean {
  return clip.errorMessage === 'removed';
}

export function clipStatusLabel(status: string, locale: UiLocale = 'en'): string {
  const s = CLIP_STATUS[status];
  return s ? pickText(s, locale) : status;
}

/** User-facing clip error — hides raw HTTP details when possible. */
export function formatClipErrorMessage(message: string, locale: UiLocale = 'en'): string {
  const lower = message.toLowerCase();
  if (message.includes('503') || lower.includes('service unavailable')) {
    return pickText(
      {
        en: 'Transcription service was busy — tap Retry transcription.',
        hi: 'प्रतिलेखन सेवा व्यस्त थी — Retry transcription दबाएं।',
      },
      locale,
    );
  }
  if (message.includes('502') || message.includes('504') || lower.includes('timeout')) {
    return pickText(
      {
        en: 'Transcription timed out — tap Retry transcription.',
        hi: 'प्रतिलेखन समय समाप्त — Retry transcription दबाएं।',
      },
      locale,
    );
  }
  return message.length > 180 ? `${message.slice(0, 180)}…` : message;
}

export function sessionStatusLabel(status: string, locale: UiLocale = 'en'): string {
  const s = SESSION_STATUS[status];
  return s ? pickText(s, locale) : status;
}
