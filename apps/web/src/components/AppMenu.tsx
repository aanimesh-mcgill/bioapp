import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { T } from '@/components/BilingualText';

const INFO_LINKS = [
  { to: '/about', en: 'About us', hi: 'हमारे बारे में' },
  { to: '/terms', en: 'Terms & Conditions', hi: 'नियम और शर्तें' },
  { to: '/privacy', en: 'Privacy Policy', hi: 'गोपनीयता नीति' },
];

function userDisplayName(
  profile: { displayName?: string } | null,
  user: { displayName?: string | null; email?: string | null } | null,
): string {
  const name = profile?.displayName?.trim() || user?.displayName?.trim() || '';
  if (name) return name;
  return user?.email?.split('@')[0] ?? '';
}

function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, signOut } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const loginHref = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  const registerHref = `/login?mode=signup&redirect=${encodeURIComponent(location.pathname + location.search)}`;
  const displayName = user ? userDisplayName(profile, user) : '';

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      onClose();
      navigate('/login');
    } finally {
      setSigningOut(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <nav
        className="absolute left-0 top-0 z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl"
        aria-label={t({ en: 'Main menu', hi: 'मुख्य मेनू' })}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className={`font-semibold text-brand-700 ${locale === 'hi' ? 'font-hindi' : ''}`}>
            <T en="Menu" hi="मेनू" />
          </p>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label={t({ en: 'Close menu', hi: 'मेनू बंद करें' })}
          >
            ✕
          </button>
        </div>

        {user && displayName && (
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              <T en="Account" hi="खाता" />
            </p>
            <p className={`mt-0.5 truncate text-sm font-semibold text-brand-800 ${locale === 'hi' ? 'font-hindi' : ''}`}>
              {displayName}
            </p>
            {user.email && user.email !== displayName && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
            )}
          </div>
        )}

        <ul className="flex-1 overflow-y-auto py-2">
          {user && (
            <li>
              <Link
                to="/settings"
                className={`block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-brand-50 ${locale === 'hi' ? 'font-hindi' : ''}`}
                onClick={onClose}
              >
                <T en="Settings" hi="सेटिंग्स" />
              </Link>
            </li>
          )}
          {INFO_LINKS.map(({ to, en, hi }) => (
            <li key={to}>
              <Link
                to={to}
                className={`block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-brand-50 ${locale === 'hi' ? 'font-hindi' : ''}`}
                onClick={onClose}
              >
                {t({ en, hi })}
              </Link>
            </li>
          ))}
          {!user && (
            <>
              <li>
                <Link
                  to={loginHref}
                  className={`block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-brand-50 ${locale === 'hi' ? 'font-hindi' : ''}`}
                  onClick={onClose}
                >
                  <T en="Log in" hi="लॉग इन" />
                </Link>
              </li>
              <li>
                <Link
                  to={registerHref}
                  className={`block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-brand-50 ${locale === 'hi' ? 'font-hindi' : ''}`}
                  onClick={onClose}
                >
                  <T en="Register" hi="पंजीकरण" />
                </Link>
              </li>
            </>
          )}
        </ul>

        {user && (
          <div className="border-t border-slate-100 px-4 py-2">
            <button
              type="button"
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 ${locale === 'hi' ? 'font-hindi' : ''}`}
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? (
                <T en="Signing out…" hi="साइन आउट…" />
              ) : (
                <T en="Log out" hi="लॉग आउट" />
              )}
            </button>
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-slate-400">
          <T en="AATMA KATHA" hi="AATMA KATHA" />
        </div>
      </nav>
    </div>,
    document.body,
  );
}

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const t = usePickText();

  return (
    <>
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        onClick={() => setOpen(true)}
        aria-label={t({ en: 'Open menu', hi: 'मेनू खोलें' })}
        aria-expanded={open}
      >
        ☰
      </button>
      <MenuDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
