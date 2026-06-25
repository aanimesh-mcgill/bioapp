export type UiLocale = 'en' | 'hi';

export interface BilingualString {
  en: string;
  hi: string;
}

export function pickText({ en, hi }: BilingualString, locale: UiLocale): string {
  return locale === 'hi' ? hi : en;
}

export const UI_LOCALE_STORAGE_KEY = 'autobio.uiLocale';

export function readStoredLocale(): UiLocale {
  try {
    const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    if (stored === 'hi' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}
