import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { acceptInvitation, subscribeToInvitations } from '@/services/books';
import type { BookInvitation } from '@/types';

export function InvitationsPage() {
  const { user, profile } = useAuth();
  const { selectBook } = useBook();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<BookInvitation[]>([]);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeToInvitations(user.uid, profile?.email, setInvitations);
  }, [user, profile?.email]);

  const handleAccept = async (invitation: BookInvitation) => {
    if (!user || !profile?.email) return;
    setLoadingInviteId(invitation.id);
    setError('');
    try {
      const accepted = await acceptInvitation(invitation.token, {
        userId: user.uid,
        email: profile.email,
      });
      selectBook(accepted.bookId);
      navigate('/contribute');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not accept invitation.');
    } finally {
      setLoadingInviteId(null);
    }
  };

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-600">Invitations</h1>
      <p className="mb-4 text-sm text-slate-600">
        Accept invitations to collaborate, view old stories, and keep adding new content.
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {invitations.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No invitations yet. When someone invites you to a book, it will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <article key={invitation.id} className="card">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{invitation.bookTitle}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    invitation.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : invitation.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {invitation.status}
                </span>
              </div>
              <p className="text-sm text-slate-600">Invited by {invitation.inviterName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {invitation.createdAt.toLocaleDateString()} · {invitation.inviteeEmail}
              </p>

              <div className="mt-3 flex gap-2">
                {invitation.status === 'pending' && (
                  <button
                    className="btn-primary flex-1"
                    onClick={() => handleAccept(invitation)}
                    disabled={loadingInviteId === invitation.id}
                  >
                    {loadingInviteId === invitation.id ? 'Accepting…' : 'Accept & Open Book'}
                  </button>
                )}

                {invitation.status === 'accepted' && (
                  <button
                    className="btn-primary flex-1"
                    onClick={() => {
                      selectBook(invitation.bookId);
                      navigate('/contribute');
                    }}
                  >
                    Open Contribution Page
                  </button>
                )}

                <Link
                  className="btn-secondary flex-1 text-center"
                  to={`/invite/${invitation.token}`}
                >
                  Open Invite Link
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
