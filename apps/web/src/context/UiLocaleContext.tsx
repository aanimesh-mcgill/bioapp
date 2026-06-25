import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  pickText,
  readStoredLocale,
  UI_LOCALE_STORAGE_KEY,
  type BilingualString,
  type UiLocale,
} from '@/lib/locale';

interface UiLocaleContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  toggleLocale: () => void;
  t: (bilingual: BilingualString) => string;
}

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

export function UiLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(() => readStoredLocale());

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(UI_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'hi' : 'en');
  }, [locale, setLocale]);

  const t = useCallback((bilingual: BilingualString) => pickText(bilingual, locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUiLocale() {
  const ctx = useContext(UiLocaleContext);
  if (!ctx) throw new Error('useUiLocale must be used within UiLocaleProvider');
  return ctx;
}

/** Pick en or hi from a bilingual pair using the current UI locale. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePickText() {
  return useUiLocale().t;
}
