import { useEffect, useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { consumePendingInviteToken } from '@/lib/pendingInvite';
import { getAuthErrorMessage, isIosDevice, isStandalonePwa } from '@/lib/authErrors';
import { BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { AppMenu } from '@/components/AppMenu';
import { LanguageToggle } from '@/components/LanguageToggle';
import { usePickText } from '@/context/UiLocaleContext';

export function LoginPage() {
  const {
    user,
    loading,
    googleRedirectError,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    clearGoogleRedirectError,
  } = useAuth();
  const t = usePickText();

  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const inviteToken = searchParams.get('invite');
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (googleRedirectError) {
      setError(googleRedirectError);
    }
  }, [googleRedirectError]);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  }, [searchParams]);


  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (user) {
    const pendingInvite = inviteToken ?? consumePendingInviteToken();
    return (
      <Navigate to={pendingInvite ? `/invite/${pendingInvite}` : redirectTo} replace />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearGoogleRedirectError();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
      }
    } catch {
      setError(
        mode === 'login'
          ? t({ en: 'Invalid email or password.', hi: 'अमान्य ईमेल या पासवर्ड।' })
          : t({ en: 'Could not create account.', hi: 'खाता नहीं बन सका।' }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    clearGoogleRedirectError();
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-heritage-cream px-4 pb-8 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <AppMenu />
        <LanguageToggle />
      </div>

      <section className="-mx-4 mb-6 overflow-hidden bg-[#faf8f5]">
        <img
          src="/hero.png"
          alt="Aatma Katha — Their voice. Their stories. Your legacy."
          className="w-full object-contain"
        />
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <input
            className="input-field"
            placeholder={t({ en: 'Your name', hi: 'आपका नाम' })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className="input-field"
          type="email"
          placeholder={t({ en: 'Email', hi: 'ईमेल' })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <div className="relative">
          <input
            className="input-field pr-12"
            type={showPassword ? 'text' : 'password'}
            placeholder={t({ en: 'Password', hi: 'पासवर्ड' })}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-600"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <T en="Hide" hi="छुपाएं" />
            ) : (
              <T en="Show" hi="देखें" />
            )}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting || googleSubmitting}>
          {submitting ? (
            <BilingualBtn en="Please wait…" hi="कृपया प्रतीक्षा…" />
          ) : mode === 'login' ? (
            <BilingualBtn en="Sign In" hi="साइन इन" />
          ) : (
            <BilingualBtn en="Create Account" hi="खाता बनाएं" />
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-sm text-slate-400">
          <T en="or" hi="या" />
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        className="btn-secondary flex w-full items-center justify-center gap-2"
        onClick={handleGoogleSignIn}
        disabled={submitting || googleSubmitting}
      >
        {googleSubmitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <BilingualBtn en="Redirecting to Google…" hi="Google पर भेजा जा रहा…" />
          </>
        ) : (
          <BilingualBtn en="Continue with Google" hi="Google से जारी रखें" />
        )}
      </button>

      {isIosDevice() && isStandalonePwa() && (
        <p className="mt-3 text-center text-xs leading-relaxed text-amber-800">
          {t({
            en: 'Google sign-in from the home-screen icon can fail on iPhone. If it does, open autobio-b5dbf.web.app in Safari instead.',
            hi: 'iPhone पर होम स्क्रीन आइकन से Google साइन-इन कभी-कभी विफल होता है। Safari में autobio-b5dbf.web.app खोलकर प्रयास करें।',
          })}
        </p>
      )}

      <div className="mt-6 text-center text-sm text-slate-600">
        {mode === 'login' ? (
          <BilingualLine
            inline
            en="Don't have an account?"
            hi="खाता नहीं है?"
            hiClass="text-slate-500"
          />
        ) : (
          <BilingualLine
            inline
            en="Already have an account?"
            hi="पहले से खाता है?"
            hiClass="text-slate-500"
          />
        )}{' '}
        <button
          type="button"
          className="font-semibold text-brand-600"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
            clearGoogleRedirectError();
          }}
        >
          {mode === 'login' ? (
            <BilingualBtn en="Sign up" hi="साइन अप" />
          ) : (
            <BilingualBtn en="Sign in" hi="साइन इन" />
          )}
        </button>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
        <T en="By signing in you agree to our " hi="साइन इन करके आप हमारी " />
        <Link to="/terms" className="text-brand-600 underline">
          <T en="Terms & Conditions" hi="नियम और शर्तों" />
        </Link>
        <T en=" and " hi=" तथा " />
        <Link to="/privacy" className="text-brand-600 underline">
          <T en="Privacy Policy" hi="गोपनीयता नीति" />
        </Link>
        <T en="." hi=" से सहमत होते हैं।" />
      </p>
    </div>
  );
}
