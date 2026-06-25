import { isClipRemoved } from '@/lib/bilingualUi';
import type { AudioClip } from '@/types';
import type { UiLocale } from '@/lib/locale';

export function defaultClipLabel(clipNumber: number, locale: UiLocale = 'en'): string {
  return locale === 'hi' ? `क्लिप ${clipNumber}` : `Clip ${clipNumber}`;
}

/** Labels like "Clip 3" that were auto-filled — not user-chosen names. */
export function isAutoClipLabel(label: string, locale: UiLocale = 'en'): boolean {
  const trimmed = label.trim();
  if (locale === 'hi') return /^क्लिप \d+$/.test(trimmed);
  return /^Clip \d+$/i.test(trimmed);
}

/** Clips that share numbering scope — exactly the clips shown in this list. */
export function clipsInNumberingScope(_clips: AudioClip[], ordered: AudioClip[]): AudioClip[] {
  return ordered.filter((c) => !isClipRemoved(c));
}

export function resolveClipNumber(clip: AudioClip, scopeClips: AudioClip[]): number {
  const sorted = [...scopeClips].sort((a, b) => {
    const ta = a.createdAt?.getTime?.() ?? 0;
    const tb = b.createdAt?.getTime?.() ?? 0;
    if (ta !== tb) return ta - tb;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  if (clip.clipNumber != null && clip.clipNumber > 0) {
    const dupes = scopeClips.filter((c) => c.clipNumber === clip.clipNumber);
    // Only trust stored clipNumber when this clip uniquely owns it in the visible list.
    if (dupes.length === 1 && dupes[0].id === clip.id) {
      return clip.clipNumber;
    }
  }

  const idx = sorted.findIndex((c) => c.id === clip.id);
  return idx >= 0 ? idx + 1 : sorted.length + 1;
}

export function clipDisplayLabel(clip: AudioClip, clipNumber: number, locale: UiLocale): string {
  const custom = clip.label?.trim();
  if (custom && !isAutoClipLabel(custom, locale)) return custom;
  return defaultClipLabel(clipNumber, locale);
}
