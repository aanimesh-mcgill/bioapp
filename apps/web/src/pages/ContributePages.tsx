import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';

import { useContributorInvite } from '@/context/ContributorContext';

import { BilingualBtn, BilingualLine } from '@/components/BilingualText';

import { getBookById } from '@/services/books';



export function ContributeLandingPage() {

  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  const { invite, loading, error } = useContributorInvite();



  if (loading || authLoading) {

    return (

      <div className="flex min-h-dvh items-center justify-center bg-amber-50">

        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />

      </div>

    );

  }



  if (error || !invite) {

    return (

      <div className="flex min-h-dvh flex-col items-center justify-center bg-amber-50 px-6 text-center">

        <p className="text-lg text-slate-700">{error || 'Invite not found / आमंत्रण नहीं मिला'}</p>

        <Link to="/" className="btn-primary mt-6">

          <BilingualBtn en="Go to AATMA KATHA" hi="AATMA KATHA पर जाएं" />

        </Link>

      </div>

    );

  }



  if (user) {

    return <Navigate to={`/contribute/${invite.inviteSlug}/hub`} replace />;

  }



  return (

    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-amber-50 px-6 py-12">

      <div className="card text-center">

        <BilingualLine

          en="You're invited"

          hi="आपको आमंत्रित किया गया है"

          enClass="text-xs font-semibold uppercase tracking-wide text-accent-600"

          hiClass="text-xs font-semibold text-accent-500"

        />

        <h1 className="mt-2 font-hindi text-2xl font-bold text-brand-700">AATMA KATHA</h1>

        <p className="mt-4 text-slate-700">

          <strong>{invite.ownerName}</strong> invites you to share stories for{' '}

          <em>{invite.bookTitle}</em>

        </p>

        <p className="font-hindi mt-2 text-sm text-slate-600">

          <strong>{invite.ownerName}</strong> आपको <em>{invite.bookTitle}</em> के लिए कहानियाँ साझा करने के लिए आमंत्रित करते हैं

        </p>

        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">

          <p className="font-semibold text-brand-800">{invite.contributorName}</p>

          <p className="text-sm text-brand-600">{invite.relationship}</p>

        </div>

        <BilingualLine

          en={`Sign in to record stories, upload photos, or add memories. ${invite.ownerName} will curate what goes in the final book.`}

          hi={`कहानियाँ रिकॉर्ड करने, फोटो अपलोड करने या यादें जोड़ने के लिए साइन इन करें। ${invite.ownerName} अंतिम पुस्तक में क्या जाएगा, यह तय करेंगे।`}

          enClass="mt-4 text-sm text-slate-500"

          hiClass="mt-2 text-sm text-slate-400"

        />

      </div>



      <button type="button" className="btn-primary mt-6 w-full" onClick={() => signInWithGoogle().catch(() => {})}>

        <BilingualBtn en="Continue with Google" hi="Google से जारी रखें" />

      </button>

      <Link

        to={`/login?redirect=/contribute/${invite.inviteSlug}/hub`}

        className="btn-secondary mt-3 block w-full text-center"

      >

        <BilingualBtn en="Sign in with Email" hi="ईमेल से साइन इन" />

      </Link>

    </div>

  );

}



export function ContributeHubPage() {

  const { invite } = useContributorInvite();

  const { user } = useAuth();

  const navigate = useNavigate();

  const [readBookSlug, setReadBookSlug] = useState<string | null>(null);



  useEffect(() => {

    if (!invite?.bookId) return;

    getBookById(invite.bookId)

      .then((book) => {

        if (book?.isPublished) setReadBookSlug(book.publicSlug);

      })

      .catch(() => {});

  }, [invite?.bookId]);



  if (!invite || !user) return <Navigate to={`/contribute/${invite?.inviteSlug ?? ''}`} replace />;



  const base = `/contribute/${invite.inviteSlug}`;



  return (

    <div className="mx-auto min-h-dvh max-w-lg bg-amber-50 px-4 py-6">

      <Link to={base} className="mb-4 inline-block text-sm text-brand-600">

        ← Invite / आमंत्रण

      </Link>

      <div className="card mb-6">

        <BilingualLine en="Contributing as" hi="योगदानकर्ता के रूप में" enClass="text-xs text-slate-500" hiClass="text-xs text-slate-400" />

        <p className="font-semibold text-brand-800">{invite.contributorName}</p>

        <p className="text-sm text-brand-600">{invite.relationship}</p>

        <p className="mt-2 text-xs text-slate-500">

          For {invite.ownerName}'s book: {invite.bookTitle}

        </p>

        <p className="font-hindi text-xs text-slate-400">

          {invite.ownerName} की पुस्तक: {invite.bookTitle}

        </p>

      </div>



      {readBookSlug && (

        <Link

          to={`/read/${readBookSlug}`}

          className="card mb-6 flex items-center gap-4 py-4 transition active:scale-[0.99] hover:ring-2 hover:ring-brand-200"

        >

          <span className="text-3xl">📖</span>

          <div className="flex-1">

            <BilingualLine

              en="Read the album"

              hi="एल्बम पढ़ें"

              enClass="font-semibold text-brand-700"

              hiClass="text-sm text-brand-600"

            />

            <BilingualLine

              en="Browse photos, stories & audio — like a family photo book"

              hi="फोटो, कहानियाँ और ऑडियो — परिवार की फोटो एल्बम की तरह"

              enClass="text-sm text-slate-500"

              hiClass="text-xs text-slate-400"

            />

          </div>

          <span className="text-brand-400">→</span>

        </Link>

      )}



      <BilingualLine

        en="Add a story"

        hi="कहानी जोड़ें"

        enClass="mb-4 text-lg font-bold text-brand-700"

        hiClass="mb-4 text-base font-medium text-brand-600"

      />

      <div className="grid grid-cols-1 gap-3">

        <button

          type="button"

          className="card flex items-center gap-4 py-4 text-left active:scale-[0.98]"

          onClick={() => navigate(`${base}/record`)}

        >

          <span className="text-3xl">🎙️</span>

          <div>

            <BilingualLine en="Record audio" hi="ऑडियो रिकॉर्ड" enClass="font-semibold text-brand-700" hiClass="text-sm text-brand-600" />

            <BilingualLine en="Tell a memory in your voice" hi="अपनी आवाज़ में याद सुनाएं" enClass="text-sm text-slate-500" hiClass="text-xs text-slate-400" />

          </div>

        </button>

        <button

          type="button"

          className="card flex items-center gap-4 py-4 text-left active:scale-[0.98]"

          onClick={() => navigate(`${base}/add-photo`)}

        >

          <span className="text-3xl">📷</span>

          <div>

            <BilingualLine en="Photo + story" hi="फोटो + कहानी" enClass="font-semibold text-brand-700" hiClass="text-sm text-brand-600" />

            <BilingualLine en="Upload a photo and record about it" hi="फोटो अपलोड करें और उसके बारे में रिकॉर्ड करें" enClass="text-sm text-slate-500" hiClass="text-xs text-slate-400" />

          </div>

        </button>

        <button

          type="button"

          className="card flex items-center gap-4 py-4 text-left active:scale-[0.98]"

          onClick={() => navigate(`${base}/add-text`)}

        >

          <span className="text-3xl">📝</span>

          <div>

            <BilingualLine en="Text note + story" hi="टेक्स्ट नोट + कहानी" enClass="font-semibold text-brand-700" hiClass="text-sm text-brand-600" />

            <BilingualLine en="Write a prompt and record your response" hi="प्रश्न लिखें और अपना उत्तर रिकॉर्ड करें" enClass="text-sm text-slate-500" hiClass="text-xs text-slate-400" />

          </div>

        </button>

      </div>



      <BilingualLine

        en="Stories are tagged with your name and relationship. The book owner controls chapters, titles, and publishing."

        hi="कहानियाँ आपके नाम और संबंध से टैग होती हैं। पुस्तक मालिक अध्याय, शीर्षक और प्रकाशन नियंत्रित करते हैं।"

        enClass="mt-8 text-center text-xs text-slate-400"

        hiClass="text-center text-xs text-slate-400"

      />

    </div>

  );

}


