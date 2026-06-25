export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function generatePublicSlug(title: string, id: string): string {
  const base = slugify(title) || 'story';
  return `${base}-${id.slice(0, 8)}`;
}

export function getPublicAppOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://autobio-b5dbf.web.app';
}

export function bookPublicUrl(slug: string): string {
  return `${getPublicAppOrigin()}/read/${slug}`;
}

export function storyPublicUrl(bookSlug: string, storySlug: string): string {
  return `${getPublicAppOrigin()}/read/${bookSlug}/${storySlug}`;
}

export function chapterPublicUrl(bookSlug: string, chapterId: string): string {
  return `${getPublicAppOrigin()}/read/${bookSlug}?chapter=${encodeURIComponent(chapterId)}`;
}

export function clipListenUrl(bookSlug: string, clipId: string): string {
  return `${getPublicAppOrigin()}/read/${bookSlug}/listen/${clipId}`;
}

/** Public URL for a book spread — opens the album on that page and optionally auto-plays clips. */
export function spreadPublicUrl(
  bookSlug: string,
  spread: { storyId?: string; blockId?: string; pageIndex: number },
  options?: { play?: boolean },
): string {
  const params = new URLSearchParams();
  if (spread.storyId) params.set('story', spread.storyId);
  if (spread.blockId) params.set('block', spread.blockId);
  params.set('page', String(spread.pageIndex));
  if (options?.play) params.set('play', '1');
  return `${getPublicAppOrigin()}/read/${bookSlug}?${params.toString()}`;
}

export function contributeInviteUrl(inviteSlug: string): string {
  return `${getPublicAppOrigin()}/contribute/${inviteSlug}`;
}
