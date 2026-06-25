export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function twitterShareUrl(url: string, text: string): string {
  const params = new URLSearchParams({ url, text });
  return `https://twitter.com/intent/tweet?${params}`;
}

export function whatsAppShareUrl(url: string, text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
}

export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function emailShareUrl(url: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    subject,
    body: `${body}\n\n${url}`,
  });
  return `mailto:?${params}`;
}

export function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=520');
}
