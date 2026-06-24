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

export function clipListenUrl(bookSlug: string, clipId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/read/${bookSlug}/listen/${clipId}`;
}

export function contributeInviteUrl(inviteSlug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://autobio-b5dbf.web.app';
  return `${origin}/contribute/${inviteSlug}`;
}
