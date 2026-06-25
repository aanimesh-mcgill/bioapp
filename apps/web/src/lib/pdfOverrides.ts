import type { AlbumSpread } from '@/lib/albumPages';

export type PdfSpreadOverride = {
  excluded?: boolean;
  bodyText?: string;
  imageTitle?: string;
  dateLabel?: string;
};

export type PdfOverrides = Record<string, PdfSpreadOverride>;

export function spreadOverrideKey(page: AlbumSpread): string | null {
  if (page.kind !== 'spread' || !page.storyId) return null;
  return `${page.storyId}:${page.blockId ?? 'default'}`;
}

export function applyPdfOverrides(pages: AlbumSpread[], overrides: PdfOverrides): AlbumSpread[] {
  return pages
    .map((page) => {
      const key = spreadOverrideKey(page);
      if (!key) return page;
      const override = overrides[key];
      if (!override) return page;
      return {
        ...page,
        ...(override.bodyText !== undefined ? { bodyText: override.bodyText } : {}),
        ...(override.imageTitle !== undefined ? { imageTitle: override.imageTitle } : {}),
        ...(override.dateLabel !== undefined ? { dateLabel: override.dateLabel } : {}),
      };
    })
    .filter((page) => {
      const key = spreadOverrideKey(page);
      if (!key) return true;
      return !overrides[key]?.excluded;
    });
}
