import { Link } from 'react-router-dom';
import { AppMenu } from '@/components/AppMenu';
import { LanguageToggle } from '@/components/LanguageToggle';
import { T } from '@/components/BilingualText';
import { useBook } from '@/context/BookContext';
import { usePickText } from '@/context/UiLocaleContext';

type HeritageHeaderProps = {
  /** Optional small label above the title (omit for book name only) */
  kicker?: { en: string; hi: string };
  title?: string;
  subtitle?: { en: string; hi: string };
  showBookLink?: boolean;
};

export function HeritageHeader({
  kicker,
  title,
  subtitle,
  showBookLink = true,
}: HeritageHeaderProps) {
  const { activeBook, loading } = useBook();
  const t = usePickText();

  const displayTitle = title ?? (loading ? '…' : activeBook?.title ?? t({ en: 'Your Book', hi: 'आपकी पुस्तक' }));

  return (
    <header className="app-top-bar px-5 py-3">
      <div className="flex items-start gap-3">
        <AppMenu />
        <div className="min-w-0 flex-1">
          {kicker && (
            <p className="heritage-label">
              {showBookLink ? (
                <Link to="/books?tab=active" className="hover:text-brand-600">
                  {t(kicker).toUpperCase()}
                </Link>
              ) : (
                t(kicker).toUpperCase()
              )}
            </p>
          )}
          <h1 className="heritage-title truncate">
            {showBookLink && !title ? (
              <Link to="/books?tab=active" className="hover:text-brand-600">
                {displayTitle}
              </Link>
            ) : (
              displayTitle
            )}
          </h1>
          {subtitle && (
            <p className="mt-0.5 font-serif text-sm italic text-heritage-muted">{t(subtitle)}</p>
          )}
        </div>
        <LanguageToggle />
      </div>
    </header>
  );
}

export function HeritagePageTitle({
  en,
  hi,
  subtitle,
}: {
  en: string;
  hi: string;
  subtitle?: { en: string; hi: string };
}) {
  const t = usePickText();
  return (
    <div className="mb-6">
      <h2 className="heritage-title">{t({ en, hi })}</h2>
      {subtitle && <p className="mt-1 font-serif text-sm italic text-heritage-muted">{t(subtitle)}</p>}
    </div>
  );
}

export function HeritageSectionLabel({ en, hi }: { en: string; hi: string }) {
  const t = usePickText();
  return <p className="heritage-label mb-3">{t({ en, hi })}</p>;
}
