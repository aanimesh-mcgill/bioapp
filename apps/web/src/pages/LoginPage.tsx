import { useEffect, useState } from 'react';

import { Navigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import { getAuthErrorMessage } from '@/lib/authErrors';

import { BilingualBtn, BilingualLine } from '@/components/BilingualText';



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

  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [name, setName] = useState('');

  const [error, setError] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get('redirect') ?? '/';



  useEffect(() => {

    if (googleRedirectError) {

      setError(googleRedirectError);

    }

  }, [googleRedirectError]);



  if (loading) {

    return (

      <div className="flex min-h-dvh items-center justify-center">

        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />

      </div>

    );

  }



  if (user) return <Navigate to={redirectTo} replace />;



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

          ? 'Invalid email or password. / अमान्य ईमेल या पासवर्ड।'

          : 'Could not create account. / खाता नहीं बन सका।',

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

    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8 pt-4">

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

            placeholder="Your name / आपका नाम"

            value={name}

            onChange={(e) => setName(e.target.value)}

            required

          />

        )}

        <input

          className="input-field"

          type="email"

          placeholder="Email / ईमेल"

          value={email}

          onChange={(e) => setEmail(e.target.value)}

          required

          autoComplete="email"

        />

        <div className="relative">

          <input

            className="input-field pr-12"

            type={showPassword ? 'text' : 'password'}

            placeholder="Password / पासवर्ड"

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

            {showPassword ? 'Hide / छुपाएं' : 'Show / देखें'}

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

        <span className="text-sm text-slate-400">or / या</span>

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



      <p className="mt-6 text-center text-sm text-slate-600">

        {mode === 'login' ? (

          <BilingualLine

            en="Don't have an account?"

            hi="खाता नहीं है?"

            enClass="inline"

            hiClass="inline font-hindi text-slate-500"

          />

        ) : (

          <BilingualLine

            en="Already have an account?"

            hi="पहले से खाता है?"

            enClass="inline"

            hiClass="inline font-hindi text-slate-500"

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

      </p>

    </div>

  );

}


