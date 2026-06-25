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

export function bookPublicUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/read/${slug}`;
}

export function storyPublicUrl(bookSlug: string, storySlug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/read/${bookSlug}/${storySlug}`;
}

export function chapterPublicUrl(bookSlug: string, chapterId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/read/${bookSlug}?chapter=${encodeURIComponent(chapterId)}`;
}

export function clipListenUrl(bookSlug: string, clipId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/read/${bookSlug}/listen/${clipId}`;
}

/** Public URL for a book spread — opens the album on that page and optionally auto-plays clips. */
export function spreadPublicUrl(
  bookSlug: string,
  spread: { storyId?: string; blockId?: string; pageIndex: number },
  options?: { play?: boolean },
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  const params = new URLSearchParams();
  params.set('page', String(spread.pageIndex));
  if (spread.storyId) params.set('story', spread.storyId);
  if (spread.blockId) params.set('block', spread.blockId);
  if (options?.play) params.set('play', '1');
  return `${origin}/read/${bookSlug}?${params.toString()}`;
}

export function contributeInviteUrl(inviteSlug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/contribute/${inviteSlug}`;
}
