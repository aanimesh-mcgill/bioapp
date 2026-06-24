import type { ContributorInvite } from '@/types';
import type { CreateSessionOpts } from '@/services/storySessions';

const defaultPrefs = {
  languageHint: 'mixed' as const,
  hindiOutputMode: 'hindi_script' as const,
  perspective: 'first' as const,
};

export function contributorSessionBase(
  userId: string,
  invite: ContributorInvite,
): Pick<
  CreateSessionOpts,
  | 'userId'
  | 'bookId'
  | 'bookOwnerId'
  | 'contributorInviteId'
  | 'contributorName'
  | 'contributorRelationship'
  | 'isContributorStory'
  | 'languageHint'
  | 'hindiOutputMode'
  | 'perspective'
> {
  return {
    userId,
    bookId: invite.bookId,
    bookOwnerId: invite.ownerId,
    contributorInviteId: invite.id,
    contributorName: invite.contributorName,
    contributorRelationship: invite.relationship,
    isContributorStory: true,
    ...defaultPrefs,
  };
}

export function contributorStoryTitle(invite: ContributorInvite, topic: string): string {
  return `${invite.contributorName} — ${topic}`;
}
