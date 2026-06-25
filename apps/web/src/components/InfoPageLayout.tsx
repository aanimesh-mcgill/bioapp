import { Link } from 'react-router-dom';
import { AppMenu } from '@/components/AppMenu';
import { PageHeading, T } from '@/components/BilingualText';
import { LanguageToggle } from '@/components/LanguageToggle';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import type { BilingualString } from '@/lib/locale';
import type { ReactNode } from 'react';

export function InfoSection({ title, paragraphs }: { title: BilingualString; paragraphs: BilingualString[] }) {
  const t = usePickText();
  const { locale } = useUiLocale();
  const isHi = locale === 'hi';

  return (
    <section className="mb-6">
      <h2 className={`mb-2 font-semibold text-slate-800 ${isHi ? 'font-hindi' : ''}`}>{t(title)}</h2>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={`mb-2 text-sm leading-relaxed text-slate-600 ${isHi ? 'font-hindi text-slate-500' : ''}`}
        >
          {t(p)}
        </p>
      ))}
    </section>
  );
}

export function InfoPageLayout({
  title,
  subtitle,
  children,
}: {
  title: BilingualString;
  subtitle?: BilingualString;
  children: ReactNode;
}) {
  const t = usePickText();
  const { locale } = useUiLocale();

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <AppMenu />
        <Link
          to="/"
          className={`text-sm font-medium text-brand-600 ${locale === 'hi' ? 'font-hindi' : ''}`}
        >
          <T en="← Back" hi="← वापस" />
        </Link>
        <div className="flex-1" />
        <LanguageToggle />
      </div>

      <div className="px-4 py-6 pb-10">
        <PageHeading {...title} className="mb-2" />
        {subtitle && (
          <p className={`mb-6 text-xs text-slate-400 ${locale === 'hi' ? 'font-hindi' : ''}`}>{t(subtitle)}</p>
        )}
        {children}
      </div>
    </div>
  );
}
