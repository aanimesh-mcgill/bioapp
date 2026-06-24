import { useMemo, useState } from 'react';
import { BookSwitcher } from '@/components/BookSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { createBookInvitation, refreshPublicBookSnapshot } from '@/services/books';

export function BooksPage() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [sharingLink, setSharingLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isOwner = useMemo(
    () => !!user && !!activeBook && activeBook.ownerId === user.uid,
    [user, activeBook],
  );

  const baseUrl = window.location.origin;

  const handleInvite = async () => {
    if (!activeBook || !user || !profile || !inviteEmail.trim()) return;
    setBusy(true);
    setError('');
    try {
      const token = await createBookInvitation({
        book: activeBook,
        inviterId: user.uid,
        inviterName: profile.displayName || profile.email,
        inviteeEmail: inviteEmail,
      });
      const fullLink = `${baseUrl}/invite/${token}`;
      setInviteLink(fullLink);
      await navigator.clipboard.writeText(fullLink);
      setInviteEmail('');
    } catch {
      setError('Could not create invitation link.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePublicLink = async () => {
    if (!activeBook || !user) return;
    setBusy(true);
    setError('');
    try {
      const token = await refreshPublicBookSnapshot(activeBook.id, user.uid);
      const fullLink = `${baseUrl}/browse/${token}`;
      setSharingLink(fullLink);
      await navigator.clipboard.writeText(fullLink);
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : 'Could not create share link for this book.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-600">Books</h1>
      <BookSwitcher />

      {activeBook && (
        <section className="card mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{activeBook.title}</h2>
          {activeBook.description && <p className="mt-1 text-sm text-slate-600">{activeBook.description}</p>}
          <p className="mt-2 text-xs text-slate-500">
            {isOwner
              ? 'You are the owner of this book.'
              : 'You are a collaborator on this book.'}
          </p>
          {activeBook.collaborators.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Collaborators: {activeBook.collaborators.length}
            </p>
          )}
        </section>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {activeBook && isOwner && (
        <>
          <section className="card mb-4 space-y-3">
            <h2 className="text-base font-semibold text-slate-800">Invite collaborators</h2>
            <input
              className="input-field"
              type="email"
              placeholder="Collaborator email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
            <button
              className="btn-primary w-full"
              disabled={busy || !inviteEmail.trim()}
              onClick={handleInvite}
            >
              {busy ? 'Creating…' : 'Create invitation link'}
            </button>
            {inviteLink && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Invitation link (copied):</p>
                <p className="break-all text-sm text-brand-700">{inviteLink}</p>
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="text-base font-semibold text-slate-800">Public browse link</h2>
            <p className="text-sm text-slate-600">
              Refreshes a read-only snapshot outsiders can open without getting permission errors.
            </p>
            <button className="btn-primary w-full" disabled={busy} onClick={handleCreatePublicLink}>
              {busy ? 'Generating…' : 'Create / Refresh browse link'}
            </button>
            {sharingLink && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Public link (copied):</p>
                <p className="break-all text-sm text-brand-700">{sharingLink}</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
