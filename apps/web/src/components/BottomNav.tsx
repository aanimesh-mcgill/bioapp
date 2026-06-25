import { NavLink } from 'react-router-dom';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';

type NavItem = {
  to: string;
  icon: string;
  end: boolean;
  text: string;
};

export function BottomNav() {
  const t = usePickText();
  const { locale } = useUiLocale();

  const links: NavItem[] = [
    { to: '/', icon: '🏠', end: true, text: t({ en: 'Home', hi: 'होम' }) },
    { to: '/photos', icon: '📷', end: false, text: t({ en: 'Photos', hi: 'फोटो' }) },
    { to: '/prompts', icon: '✨', end: false, text: t({ en: 'Prompts', hi: 'प्रश्न' }) },
    { to: '/book', icon: '📖', end: false, text: t({ en: 'Book', hi: 'पुस्तक' }) },
    { to: '/stories', icon: '🎙️', end: false, text: t({ en: 'Stories', hi: 'कहानियाँ' }) },
    { to: '/books', icon: '📚', end: false, text: t({ en: 'Library', hi: 'पुस्तकालय' }) },
  ];

  return (
    <nav className="app-bottom-nav" aria-label={t({ en: 'Main navigation', hi: 'मुख्य नेविगेशन' })}>
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-0.5">
        {links.map(({ to, icon, end, text }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-xs font-semibold transition active:opacity-80 ${
                isActive ? 'text-brand-600' : 'text-heritage-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-xl leading-none" aria-hidden>
                  {icon}
                </span>
                <span
                  className={`max-w-full truncate leading-tight ${
                    locale === 'hi' ? 'font-hindi text-[11px]' : 'text-xs uppercase tracking-wide'
                  }`}
                >
                  {text}
                </span>
                {isActive && <span className="nav-dot mt-0.5" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
