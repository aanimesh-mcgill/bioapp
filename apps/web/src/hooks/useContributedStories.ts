import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getContributorInviteById,
  subscribeToContributorInvitesForUser,
} from '@/services/invites';
import { subscribeToSessions } from '@/services/storySessions';
import type { ContributorInvite, StorySession } from '@/types';

export type ContributedStoryGroup = {
  inviteId: string;
  bookTitle: string;
  ownerName: string;
  inviteSlug: string | null;
  stories: StorySession[];
};

export function useContributedStories() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StorySession[]>([]);
  const [invites, setInvites] = useState<ContributorInvite[]>([]);
  const [extraInvites, setExtraInvites] = useState<Record<string, ContributorInvite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubSessions = subscribeToSessions(user.uid, setSessions);
    const unsubInvites = subscribeToContributorInvitesForUser(user.uid, (next) => {
      setInvites(next);
      setLoading(false);
    });
    return () => {
      unsubSessions();
      unsubInvites();
    };
  }, [user]);

  const contributedStories = useMemo(
    () => sessions.filter((s) => s.isContributorStory),
    [sessions],
  );

  const inviteById = useMemo(() => {
    const map = new Map<string, ContributorInvite>();
    for (const invite of invites) map.set(invite.id, invite);
    for (const [id, invite] of Object.entries(extraInvites)) map.set(id, invite);
    return map;
  }, [invites, extraInvites]);

  const missingInviteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const story of contributedStories) {
      if (story.contributorInviteId && !inviteById.has(story.contributorInviteId)) {
        ids.add(story.contributorInviteId);
      }
    }
    return [...ids];
  }, [contributedStories, inviteById]);

  useEffect(() => {
    if (missingInviteIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const fetched: Record<string, ContributorInvite> = {};
      await Promise.all(
        missingInviteIds.map(async (id) => {
          const invite = await getContributorInviteById(id);
          if (invite) fetched[id] = invite;
        }),
      );
      if (!cancelled && Object.keys(fetched).length > 0) {
        setExtraInvites((prev) => ({ ...prev, ...fetched }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missingInviteIds.join(',')]);

  const groups = useMemo((): ContributedStoryGroup[] => {
    const byInvite = new Map<string, StorySession[]>();
    for (const story of contributedStories) {
      const key = story.contributorInviteId ?? `orphan:${story.bookId ?? story.id}`;
      const list = byInvite.get(key) ?? [];
      list.push(story);
      byInvite.set(key, list);
    }

    const result: ContributedStoryGroup[] = [];
    for (const [inviteId, stories] of byInvite) {
      const invite = inviteId.startsWith('orphan:') ? null : inviteById.get(inviteId) ?? null;
      result.push({
        inviteId,
        bookTitle: invite?.bookTitle ?? 'Shared book',
        ownerName: invite?.ownerName ?? '',
        inviteSlug: invite?.inviteSlug ?? null,
        stories: stories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      });
    }

    return result.sort((a, b) => {
      const aTime = a.stories[0]?.updatedAt.getTime() ?? 0;
      const bTime = b.stories[0]?.updatedAt.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [contributedStories, inviteById]);

  const activeInvites = useMemo(() => invites.filter((i) => i.isActive), [invites]);

  return {
    loading,
    contributedStories,
    groups,
    activeInvites,
    invites,
  };
}
