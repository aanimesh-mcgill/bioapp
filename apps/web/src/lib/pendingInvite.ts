const PENDING_INVITE_KEY = 'autobio.pendingInviteToken';

export function setPendingInviteToken(token: string) {
  localStorage.setItem(PENDING_INVITE_KEY, token);
}

export function consumePendingInviteToken() {
  const token = localStorage.getItem(PENDING_INVITE_KEY);
  if (!token) return null;
  localStorage.removeItem(PENDING_INVITE_KEY);
  return token;
}

export function clearPendingInviteToken() {
  localStorage.removeItem(PENDING_INVITE_KEY);
}
