import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { getInviteBySlug } from '@/services/invites';
import type { ContributorInvite } from '@/types';

interface ContributorContextValue {
  invite: ContributorInvite | null;
  loading: boolean;
  error: string;
}

const ContributorContext = createContext<ContributorContextValue | null>(null);

export function ContributorProvider({ children }: { children: ReactNode }) {
  const { inviteSlug } = useParams<{ inviteSlug: string }>();
  const [invite, setInvite] = useState<ContributorInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inviteSlug) {
      setError('Invalid invite link.');
      setLoading(false);
      return;
    }
    getInviteBySlug(inviteSlug)
      .then((inv) => {
        if (!inv) setError('This invite link is invalid or has expired.');
        else setInvite(inv);
      })
      .catch(() => setError('Could not load invite.'))
      .finally(() => setLoading(false));
  }, [inviteSlug]);

  return (
    <ContributorContext.Provider value={{ invite, loading, error }}>
      {children}
    </ContributorContext.Provider>
  );
}

export function useContributorInvite() {
  const ctx = useContext(ContributorContext);
  if (!ctx) throw new Error('useContributorInvite must be used within ContributorProvider');
  return ctx;
}
