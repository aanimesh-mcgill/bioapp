import { Link, Navigate } from 'react-router-dom';
import { BilingualBtn } from '@/components/BilingualText';
import { ContributedStoriesSection } from '@/components/contributor/ContributedStoriesSection';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { useAuth } from '@/context/AuthContext';
import { useContributedStories } from '@/hooks/useContributedStories';

export function ContributorHomePage() {
  const { user, loading: authLoading } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const { loading, activeInvites, groups } = useContributedStories();

  const recentSlug = (() => {
    if (!user) return null;
    try {
      return localStorage.getItem(`autobio.lastContributorInvite.${user.uid}`);
    } catch {
      return null;
    }
  })();

  if (authLoading || loading) {
    return (
      <div className="heritage-page flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?redirect=/contribute" replace />;
  }

  if (activeInvites.length === 1) {
    return <Navigate to={`/contribute/${activeInvites[0].inviteSlug}/hub`} replace />;
  }

  if (activeInvites.length === 0 && recentSlug && groups.length === 0) {
    return <Navigate to={`/contribute/${recentSlug}/hub`} replace />;
  }

  return (
    <div className="heritage-page">
      <HeritagePageTitle en="Contribute" hi="योगदान" />

      {activeInvites.length === 0 ? (
        <div className="card mb-6 py-10 text-center">
          <span className="mb-3 block text-4xl">✉️</span>
          <p className={`text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({
              en: "Open the personal invite link you received to add stories to someone's book.",
              hi: 'किसी की पुस्तक में कहानियाँ जोड़ने के लिए मिला व्यक्तिगत आमंत्रण लिंक खोलें।',
            })}
          </p>
          <Link to="/stories" className="btn-secondary mt-4 inline-block">
            <BilingualBtn en="Your stories" hi="आपकी कहानियाँ" />
          </Link>
        </div>
      ) : (
        <div className="mb-6 space-y-3">
          <p className={`text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {t({
              en: 'Books you have been invited to contribute to:',
              hi: 'जिन पुस्तकों में योगदान देने के लिए आमंत्रित हैं:',
            })}
          </p>
          {activeInvites.map((invite) => (
            <Link
              key={invite.id}
              to={`/contribute/${invite.inviteSlug}/hub`}
              className="card flex items-center gap-3 py-4 transition active:scale-[0.99]"
            >
              <span className="text-2xl">📖</span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg text-heritage-ink">{invite.bookTitle}</p>
                <p className="text-xs text-heritage-muted">
                  {t({ en: 'Invited by', hi: 'आमंत्रण' })} {invite.ownerName}
                </p>
                <p className="text-xs text-heritage-muted">
                  {invite.contributorName} · {invite.relationship}
                </p>
              </div>
              <span className="text-brand-600">→</span>
            </Link>
          ))}
        </div>
      )}

      <ContributedStoriesSection groups={groups} showContributeLink={false} />
    </div>
  );
}
