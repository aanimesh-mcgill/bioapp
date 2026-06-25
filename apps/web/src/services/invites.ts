import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generatePublicSlug, contributeInviteUrl } from '@/lib/slug';
import type { ContributorInvite } from '@/types';

function mapInvite(id: string, data: Record<string, unknown>): ContributorInvite {
  return {
    id,
    bookId: data.bookId as string,
    ownerId: data.ownerId as string,
    ownerName: data.ownerName as string,
    bookTitle: data.bookTitle as string,
    contributorName: data.contributorName as string,
    relationship: data.relationship as string,
    inviteSlug: data.inviteSlug as string,
    isActive: (data.isActive as boolean) ?? true,
    contributorUserId: data.contributorUserId as string | undefined,
    createdAt: (data.createdAt as { toDate: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function createContributorInvite(opts: {
  bookId: string;
  ownerId: string;
  ownerName: string;
  bookTitle: string;
  contributorName: string;
  relationship: string;
}): Promise<ContributorInvite> {
  const inviteSlug = generatePublicSlug(
    `${opts.contributorName}-${opts.relationship}`,
    crypto.randomUUID().slice(0, 8),
  );

  const ref = await addDoc(collection(db, 'contributorInvites'), {
    bookId: opts.bookId,
    ownerId: opts.ownerId,
    ownerName: opts.ownerName,
    bookTitle: opts.bookTitle,
    contributorName: opts.contributorName.trim(),
    relationship: opts.relationship.trim(),
    inviteSlug,
    isActive: true,
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    ...opts,
    contributorName: opts.contributorName.trim(),
    relationship: opts.relationship.trim(),
    inviteSlug,
    isActive: true,
    createdAt: new Date(),
  };
}

export function subscribeToInvites(bookId: string, cb: (invites: ContributorInvite[]) => void) {
  const q = query(collection(db, 'contributorInvites'), where('bookId', '==', bookId));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => mapInvite(d.id, d.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  });
}

export async function getInviteBySlug(slug: string): Promise<ContributorInvite | null> {
  const q = query(
    collection(db, 'contributorInvites'),
    where('inviteSlug', '==', slug),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapInvite(d.id, d.data());
}

export async function deactivateInvite(inviteId: string) {
  await updateDoc(doc(db, 'contributorInvites', inviteId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}

export function getInviteLink(invite: ContributorInvite): string {
  return contributeInviteUrl(invite.inviteSlug);
}

export async function linkContributorUser(inviteId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'contributorInvites', inviteId), {
    contributorUserId: userId,
    updatedAt: serverTimestamp(),
  });
}

/** All contributor invites linked to this user (including inactive), for story history and slug lookup. */
export function subscribeToContributorInvitesForUser(
  userId: string,
  cb: (invites: ContributorInvite[]) => void,
): () => void {
  const q = query(
    collection(db, 'contributorInvites'),
    where('contributorUserId', '==', userId),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs
          .map((d) => mapInvite(d.id, d.data()))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      );
    },
    () => cb([]),
  );
}

export async function getContributorInviteById(inviteId: string): Promise<ContributorInvite | null> {
  const snap = await getDoc(doc(db, 'contributorInvites', inviteId));
  if (!snap.exists()) return null;
  return mapInvite(snap.id, snap.data());
}
