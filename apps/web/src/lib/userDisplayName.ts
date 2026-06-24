import type { User } from 'firebase/auth';
import type { UserProfile } from '@/types';

export function userDisplayName(user: User | null, profile: UserProfile | null): string {
  return (
    profile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    ''
  );
}
