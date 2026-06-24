import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useContributorInvite } from '@/context/ContributorContext';
import { StorySessionPage } from '@/pages/StorySessionPage';

/** Wrapper so contributors use the same recording UI with invite-scoped navigation */
export function ContributeStoryPage() {
  const { invite } = useContributorInvite();
  const { user } = useAuth();
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!invite || !user) {
    return <Navigate to={`/contribute/${invite?.inviteSlug ?? ''}`} replace />;
  }

  return (
    <div>
      <div className="border-b border-slate-200 bg-amber-50 px-4 py-2">
        <Link to={`/contribute/${invite.inviteSlug}/hub`} className="text-sm text-brand-600">
          ← Back to contribute / योगदान पर वापस
        </Link>
        <p className="text-xs text-slate-500">
          Contributing as {invite.contributorName} · {invite.relationship}
        </p>
        <p className="font-hindi text-xs text-slate-400">
          {invite.contributorName} · {invite.relationship} के रूप में
        </p>
      </div>
      <StorySessionPage key={sessionId} />
    </div>
  );
}
