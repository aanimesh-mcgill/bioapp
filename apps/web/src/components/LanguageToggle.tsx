import { useUiLocale } from '@/context/UiLocaleContext';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, toggleLocale } = useUiLocale();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLocale();
      }}
      className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-heritage-line bg-heritage-paper text-xs font-semibold text-brand-600 shadow-sm transition hover:border-brand-400 ${className}`}
      aria-label={locale === 'en' ? 'Switch to Hindi' : 'Switch to English'}
      title={locale === 'en' ? 'हिन्दी' : 'English'}
    >
      {locale === 'en' ? 'हि' : 'EN'}
    </button>
  );
}
