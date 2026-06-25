import { useEffect, useState } from 'react';
import { BilingualBtn, BilingualLine, SectionHeading, T } from '@/components/BilingualText';
import { useAuth } from '@/context/AuthContext';
import { usePickText } from '@/context/UiLocaleContext';
import {
  createBookInvitation,
  subscribeToBookOwnerInvitations,
} from '@/services/booksCollaboration';
import type { AuthorBook, BookInvitation } from '@/types';
import { ShareLinkCard, ShareLinkEmpty } from './ShareLinkCard';

export function CollaboratorAccessSection({ collabBook }: { collabBook: AuthorBook }) {
  const { user, profile } = useAuth();
  const t = usePickText();
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitations, setInvitations] = useState<BookInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    return subscribeToBookOwnerInvitations(collabBook.id, setInvitations);
  }, [collabBook.id]);

  const handleInvite = async () => {
    if (!user || !profile || !inviteEmail.trim()) return;
    setBusy(true);
    try {
      const token = await createBookInvitation({
        book: collabBook,
        inviterId: user.uid,
        inviterName: profile.displayName || profile.email,
        inviteeEmail: inviteEmail,
      });
      const fullLink = `${baseUrl}/invite/${token}`;
      await navigator.clipboard.writeText(fullLink);
      setInviteEmail('');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: BookInvitation['status']) => {
    switch (status) {
      case 'pending':
        return t({ en: 'pending', hi: 'लंबित' });
      case 'accepted':
        return t({ en: 'accepted', hi: 'स्वीकृत' });
      case 'revoked':
        return t({ en: 'revoked', hi: 'रद्द' });
      default:
        return status;
    }
  };

  return (
    <section className="card space-y-3">
      <SectionHeading en="Collaborator access" hi="सहयोगी पहुँच" />
      <BilingualLine
        en="Invite someone by email to co-edit this book."
        hi="किसी को ईमेल से आमंत्रित करें ताकि वे इस पुस्तक को साथ में संपादित कर सकें।"
        enClass="text-sm text-slate-600"
        hiClass="text-sm text-slate-500"
      />
      <input
        className="input-field"
        type="email"
        placeholder={t({ en: 'Collaborator email', hi: 'सहयोगी का ईमेल' })}
        value={inviteEmail}
        onChange={(e) => setInviteEmail(e.target.value)}
        disabled={busy}
      />
      <button
        type="button"
        className="btn-primary w-full"
        disabled={busy || !inviteEmail.trim()}
        onClick={handleInvite}
      >
        <BilingualBtn
          en={busy ? 'Creating…' : 'Create invitation link'}
          hi={busy ? 'बना रहे…' : 'आमंत्रण लिंक बनाएं'}
        />
      </button>

      {invitations.length === 0 ? (
        <ShareLinkEmpty
          en="No collaborator invitations yet."
          hi="अभी कोई सहयोगी आमंत्रण नहीं।"
        />
      ) : (
        <ul className="space-y-2">
          {invitations.map((invite) => {
            const link = `${baseUrl}/invite/${invite.token}`;
            return (
              <li key={invite.id}>
                <ShareLinkCard
                  meta={`${invite.inviteeEmail} · ${statusLabel(invite.status)}`}
                  url={link}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
