import { Link } from 'react-router-dom';
import { usePickText } from '@/context/UiLocaleContext';
import {
  contributorStoryHref,
  contributorStoryMeta,
  contributorStoryThumb,
  isContributorStoryEditable,
  isContributorStorySubmitted,
} from '@/lib/contributorStories';
import type { StorySession } from '@/types';

export function ContributorStoryRow({
  story,
  inviteSlug,
  bookTitle,
}: {
  story: StorySession;
  inviteSlug: string | null;
  bookTitle?: string;
}) {
  const t = usePickText();
  const thumb = contributorStoryThumb(story);
  const editable = isContributorStoryEditable(story);
  const submitted = isContributorStorySubmitted(story);
  const href = inviteSlug ? contributorStoryHref(inviteSlug, story) : `/stories/${story.id}`;

  return (
    <Link
      to={href}
      state={
        submitted && inviteSlug
          ? { fromContributeHub: `/contribute/${inviteSlug}/hub` }
          : undefined
      }
      className={`flex items-center gap-3 border-b border-heritage-line/60 py-3 last:border-0 ${
        submitted ? 'hover:bg-heritage-cream/40' : ''
      }`}
    >
      {thumb ? (
        <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-white" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-heritage-line/60 text-lg">
          📖
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-heritage-ink">{story.title}</p>
          {editable && (
            <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
              {t({ en: 'Draft', hi: 'ड्राफ्ट' })}
            </span>
          )}
          {submitted && (
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-800">
              {t({ en: 'Submitted', hi: 'जमा' })}
            </span>
          )}
        </div>
        <p className="text-xs text-heritage-muted">
          {bookTitle ? `${bookTitle} · ` : ''}
          {contributorStoryMeta(story, t)}
        </p>
      </div>
      <span className="text-heritage-muted">→</span>
    </Link>
  );
}
