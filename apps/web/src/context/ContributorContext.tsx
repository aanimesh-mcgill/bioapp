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

/** Avoid blank → redirect flash when returning from preview (provider remounts). */
const inviteCache = new Map<string, ContributorInvite>();

export function ContributorProvider({ children }: { children: ReactNode }) {
  const { inviteSlug } = useParams<{ inviteSlug: string }>();
  const [invite, setInvite] = useState<ContributorInvite | null>(() =>
    inviteSlug ? (inviteCache.get(inviteSlug) ?? null) : null,
  );
  const [loading, setLoading] = useState(() =>
    inviteSlug ? !inviteCache.has(inviteSlug) : true,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inviteSlug) {
      setError('Invalid invite link.');
      setLoading(false);
      return;
    }

    const cached = inviteCache.get(inviteSlug);
    if (cached) {
      setInvite(cached);
      setError('');
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;
    getInviteBySlug(inviteSlug)
      .then((inv) => {
        if (cancelled) return;
        if (!inv) {
          setError('This invite link is invalid or has expired.');
          setInvite(null);
        } else {
          inviteCache.set(inviteSlug, inv);
          setInvite(inv);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load invite.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteSlug]);

  return (
    <ContributorContext.Provider value={{ invite, loading, error }}>
      {children}
    </ContributorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContributorInvite() {
  const ctx = useContext(ContributorContext);
  if (!ctx) throw new Error('useContributorInvite must be used within ContributorProvider');
  return ctx;
}
