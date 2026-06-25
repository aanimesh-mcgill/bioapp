import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useContributorInvite } from '@/context/ContributorContext';
import { BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { ContributorNewStoryModal } from '@/components/contributor/ContributorNewStoryModal';
import { ContributorStoryRow } from '@/components/contributor/ContributorStoryRow';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { getBookById } from '@/services/books';
import { linkContributorUser } from '@/services/invites';
import { subscribeToSessions } from '@/services/storySessions';

/** Cache published album slug so preview link does not flash on hub remount. */
const publishedSlugByBookId = new Map<string, string>();

export function ContributeLandingPage() {
  const t = usePickText();
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
        <p className="text-lg text-slate-700">
          {error || t({ en: 'Invite not found', hi: 'आमंत्रण नहीं मिला' })}
        </p>
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
          <strong>{invite.ownerName}</strong> invites you to share stories for <em>{invite.bookTitle}</em>
        </p>
        <p className="font-hindi mt-2 text-sm text-slate-600">
          <strong>{invite.ownerName}</strong> आपको <em>{invite.bookTitle}</em> के लिए कहानियाँ साझा करने के लिए
          आमंत्रित करते हैं
        </p>
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
          <p className="font-semibold text-brand-800">{invite.contributorName}</p>
          <p className="text-sm text-brand-600">{invite.relationship}</p>
        </div>
        <BilingualLine
          en={`Sign in to add stories like you would to your own book. ${invite.ownerName} will place them in chapters.`}
          hi={`अपनी पुस्तक की तरह कहानियाँ जोड़ने के लिए साइन इन करें। ${invite.ownerName} उन्हें अध्यायों में रखेंगे।`}
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
  const t = usePickText();
  const { locale } = useUiLocale();
  const { inviteSlug } = useParams<{ inviteSlug: string }>();
  const { invite, loading: inviteLoading } = useContributorInvite();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [readBookSlug, setReadBookSlug] = useState<string | null>(() => {
    const bookId = invite?.bookId;
    return bookId ? (publishedSlugByBookId.get(bookId) ?? null) : null;
  });
  const [allSessions, setAllSessions] = useState<import('@/types').StorySession[]>([]);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [showNewStory, setShowNewStory] = useState(false);

  useEffect(() => {
    if (!invite?.bookId) return;
    const cached = publishedSlugByBookId.get(invite.bookId);
    if (cached) {
      setReadBookSlug(cached);
      return;
    }
    let cancelled = false;
    getBookById(invite.bookId)
      .then((book) => {
        if (cancelled || !book?.isPublished || !book.publicSlug) return;
        publishedSlugByBookId.set(invite.bookId, book.publicSlug);
        setReadBookSlug(book.publicSlug);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [invite?.bookId]);

  useEffect(() => {
    if (!user || !invite) return;
    void linkContributorUser(invite.id, user.uid).catch(() => {});
    try {
      localStorage.setItem(`autobio.lastContributorInvite.${user.uid}`, invite.inviteSlug);
    } catch {
      /* ignore */
    }
  }, [user, invite]);

  useEffect(() => {
    if (!user) {
      setAllSessions([]);
      setSessionsReady(false);
      return;
    }
    setSessionsReady(false);
    return subscribeToSessions(user.uid, (sessions) => {
      setAllSessions(sessions);
      setSessionsReady(true);
    });
  }, [user]);

  const myStories = useMemo(() => {
    if (!invite) return [];
    return allSessions.filter((s) => s.contributorInviteId === invite.id);
  }, [allSessions, invite]);

  if (authLoading || inviteLoading) {
    return (
      <div className="heritage-page flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/contribute/${inviteSlug ?? invite?.inviteSlug ?? ''}`} replace />;
  }

  if (!invite) {
    return <Navigate to={`/contribute/${inviteSlug ?? ''}`} replace />;
  }

  return (
    <div className="heritage-page">
      <ContributorNewStoryModal open={showNewStory} onClose={() => setShowNewStory(false)} invite={invite} />

      <HeritagePageTitle
        en={invite.bookTitle}
        hi={invite.bookTitle}
        subtitle={{
          en: `Invited by ${invite.ownerName}`,
          hi: `${invite.ownerName} का आमंत्रण`,
        }}
      />

      <div className="card mb-4 border-l-4 border-l-accent-400">
        <BilingualLine
          en="Contributing as"
          hi="योगदानकर्ता"
          enClass="text-xs text-heritage-muted"
          hiClass="text-xs text-heritage-muted"
        />
        <p className="font-semibold text-heritage-ink">{invite.contributorName}</p>
        <p className="text-sm text-brand-600">{invite.relationship}</p>
        <BilingualLine
          en="Stories you submit are added to this book. You keep a copy in your account."
          hi="आपकी जमा की गई कहानियाँ इस पुस्तक में जोड़ी जाती हैं। आपके खाते में एक प्रति रहती है।"
          enClass="mt-2 text-xs text-heritage-muted"
          hiClass="text-xs text-heritage-muted"
        />
      </div>

      {readBookSlug && (
        <Link
          to={`/read/${readBookSlug}`}
          state={{ fromContributeHub: `/contribute/${invite.inviteSlug}/hub` }}
          className="card mb-4 flex items-center gap-3 py-3 transition active:scale-[0.99]"
        >
          <span className="text-2xl">📖</span>
          <div className="flex-1">
            <p className="font-medium text-heritage-ink">{t({ en: 'Preview album', hi: 'एल्बम देखें' })}</p>
            <p className="text-xs text-heritage-muted">
              {t({ en: 'See the published book so far', hi: 'अब तक की प्रकाशित पुस्तक देखें' })}
            </p>
          </div>
          <span className="text-brand-600">→</span>
        </Link>
      )}

      <div className="mb-4 flex gap-2">
        <button type="button" className="btn-primary flex-1 text-sm" onClick={() => setShowNewStory(true)}>
          <BilingualBtn en="+ New story" hi="+ नई कहानी" />
        </button>
      </div>

      {!sessionsReady ? (
        <div className="card flex min-h-[120px] items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : myStories.length === 0 ? (
        <div className="card py-10 text-center">
          <span className="mb-3 block text-4xl">🎙️</span>
          <p className={`text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({
              en: 'No stories yet. Tap + New story to add photos, text, and voice recordings.',
              hi: 'अभी कोई कहानी नहीं। फोटो, टेक्स्ट और आवाज़ जोड़ने के लिए + नई कहानी दबाएं।',
            })}
          </p>
        </div>
      ) : (
        <div className="card px-4 pb-2">
          <p className="heritage-label py-3 text-brand-600">
            {t({ en: 'Your contributions', hi: 'आपके योगदान' })}
          </p>
          {myStories.map((story) => (
            <ContributorStoryRow key={story.id} story={story} inviteSlug={invite.inviteSlug} />
          ))}
        </div>
      )}

      <p className={`mt-6 text-center text-xs text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
        <T
          en="When you submit a story, the book owner can review it and add it to a chapter."
          hi="जब आप कहानी जमा करते हैं, पुस्तक स्वामी उसकी समीक्षा कर अध्याय में जोड़ सकता है।"
        />
      </p>

      <button
        type="button"
        className="btn-secondary mt-4 w-full text-sm"
        onClick={() => navigate('/contribute')}
      >
        <BilingualBtn en="All invitations" hi="सभी आमंत्रण" />
      </button>
    </div>
  );
}
