import { useEffect, useState } from 'react';
import { BilingualBtn, BilingualLine, SectionHeading, T } from '@/components/BilingualText';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import {
  createContributorInvite,
  deactivateInvite,
  getInviteLink,
  subscribeToInvites,
} from '@/services/invites';
import type { ContributorInvite } from '@/types';
import { ShareLinkCard, ShareLinkEmpty } from './ShareLinkCard';

const RELATIONSHIP_SUGGESTIONS = [
  'Mother', 'Father', 'Son', 'Daughter', 'Spouse', 'Sibling',
  'Grandparent', 'Friend', 'Colleague', 'Neighbor', 'Other',
];

export function ContributorInvitesSection({
  albumBookId,
  albumBookTitle,
}: {
  albumBookId: string | null;
  albumBookTitle: string;
}) {
  const { user, profile } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [invites, setInvites] = useState<ContributorInvite[]>([]);
  const [contribName, setContribName] = useState('');
  const [contribRelation, setContribRelation] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!albumBookId) {
      setInvites([]);
      return;
    }
    return subscribeToInvites(albumBookId, setInvites);
  }, [albumBookId]);

  const handleCreate = async () => {
    if (!albumBookId || !user || !contribName.trim() || !contribRelation.trim()) return;
    setCreating(true);
    try {
      await createContributorInvite({
        bookId: albumBookId,
        ownerId: user.uid,
        ownerName: profile?.displayName ?? 'Author',
        bookTitle: albumBookTitle,
        contributorName: contribName.trim(),
        relationship: contribRelation.trim(),
      });
      setContribName('');
      setContribRelation('');
    } finally {
      setCreating(false);
    }
  };

  const activeInvites = invites.filter((inv) => inv.isActive);

  return (
    <section className="card space-y-3">
      <SectionHeading en="Invite contributors" hi="योगदानकर्ताओं को आमंत्रित करें" />
      <BilingualLine
        en="Send a personal link so family and friends can add their stories."
        hi="परिवार और दोस्तों को अपनी कहानियाँ जोड़ने के लिए व्यक्तिगत लिंक भेजें।"
        enClass="text-sm text-slate-600"
        hiClass="text-sm text-slate-500"
      />

      {!albumBookId ? (
        <p className={`text-sm text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({ en: 'Loading book…', hi: 'पुस्तक लोड हो रही…' })}
        </p>
      ) : (
        <>
          <input
            className="input-field"
            placeholder={t({ en: 'Their name (e.g. Priya)', hi: 'उनका नाम (जैसे प्रिया)' })}
            value={contribName}
            onChange={(e) => setContribName(e.target.value)}
            disabled={creating}
          />
          <input
            className="input-field"
            placeholder={t({ en: 'Relationship (e.g. Daughter)', hi: 'संबंध (जैसे बेटी)' })}
            value={contribRelation}
            onChange={(e) => setContribRelation(e.target.value)}
            list="contributor-relationships"
            disabled={creating}
          />
          <datalist id="contributor-relationships">
            {RELATIONSHIP_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={handleCreate}
            disabled={creating || !contribName.trim() || !contribRelation.trim()}
          >
            <BilingualBtn
              en={creating ? 'Creating…' : 'Create invite link'}
              hi={creating ? 'बना रहे…' : 'आमंत्रण लिंक बनाएं'}
            />
          </button>

          {activeInvites.length === 0 ? (
            <ShareLinkEmpty
              en="No contributor links yet."
              hi="अभी कोई योगदानकर्ता लिंक नहीं।"
            />
          ) : (
            <ul className="space-y-2">
              {activeInvites.map((inv) => (
                <li key={inv.id}>
                  <ShareLinkCard
                    title={inv.contributorName}
                    meta={inv.relationship}
                    url={getInviteLink(inv)}
                    showQr
                    headerAction={
                      <button
                        type="button"
                        className="shrink-0 text-xs text-red-500"
                        onClick={() => deactivateInvite(inv.id)}
                      >
                        <T en="Revoke" hi="रद्द" />
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
