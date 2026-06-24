import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { acceptInvitation, getInvitationByToken } from '@/services/books';
import type { BookInvitation } from '@/types';

const PENDING_INVITE_KEY = 'autobio.pendingInviteToken';

export function InvitationLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { user, profile, loading } = useAuth();
  const { selectBook } = useBook();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<BookInvitation | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    localStorage.setItem(PENDING_INVITE_KEY, token);
    void getInvitationByToken(token).then(setInvitation);
  }, [token]);

  useEffect(() => {
    if (!token || loading) return;
    if (!user || !profile?.email) {
      navigate(`/login?invite=${token}`, { replace: true });
      return;
    }

    void acceptInvitation(token, { userId: user.uid, email: profile.email })
      .then((accepted) => {
        localStorage.removeItem(PENDING_INVITE_KEY);
        selectBook(accepted.bookId);
        navigate('/contribute', { replace: true });
      })
      .catch((acceptError) => {
        setError(acceptError instanceof Error ? acceptError.message : 'Could not open invitation.');
      });
  }, [token, loading, user, profile?.email, navigate, selectBook]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-bold text-brand-600">Opening invitation…</h1>
      {invitation && (
        <p className="mt-2 text-slate-600">
          Joining <span className="font-semibold">{invitation.bookTitle}</span> by{' '}
          {invitation.inviterName}
        </p>
      )}
      {error && (
        <>
          <p className="mt-4 text-sm text-red-600">{error}</p>
          <Link to="/invitations" className="btn-primary mt-5 inline-block">
            Go to invitations
          </Link>
        </>
      )}
    </div>
  );
}

export function consumePendingInviteToken() {
  const token = localStorage.getItem(PENDING_INVITE_KEY);
  if (!token) return null;
  localStorage.removeItem(PENDING_INVITE_KEY);
  return token;
}
