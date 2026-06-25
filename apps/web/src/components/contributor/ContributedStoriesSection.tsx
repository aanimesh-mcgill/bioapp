import { Link } from 'react-router-dom';
import { BilingualBtn } from '@/components/BilingualText';
import { ContributorStoryRow } from '@/components/contributor/ContributorStoryRow';
import { HeritageSectionLabel } from '@/components/heritage/HeritageHeader';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import type { ContributedStoryGroup } from '@/hooks/useContributedStories';

export function ContributedStoriesSection({
  groups,
  showContributeLink = true,
  showEmpty = false,
}: {
  groups: ContributedStoryGroup[];
  showContributeLink?: boolean;
  showEmpty?: boolean;
}) {
  const t = usePickText();
  const { locale } = useUiLocale();

  if (groups.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="card py-10 text-center">
        <span className="mb-3 block text-4xl">✉️</span>
        <p className={`text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({
            en: "No stories for others' books yet. Open a personal invite link to contribute.",
            hi: 'अभी दूसरों की पुस्तकों के लिए कोई कहानी नहीं। योगदान देने के लिए व्यक्तिगत आमंत्रण लिंक खोलें।',
          })}
        </p>
        <Link to="/contribute" className="btn-secondary mt-4 inline-block">
          <BilingualBtn en="Contribute" hi="योगदान" />
        </Link>
      </div>
    );
  }

  const total = groups.reduce((n, g) => n + g.stories.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <HeritageSectionLabel
          en="Stories for others' books"
          hi="दूसरों की पुस्तकों के लिए कहानियाँ"
        />
        {showContributeLink && (
          <Link to="/contribute" className="text-xs font-semibold text-brand-600 hover:underline">
            <BilingualBtn en="Contribute" hi="योगदान" />
          </Link>
        )}
      </div>

      <p className={`text-xs text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
        {t({
          en: `${total} ${total === 1 ? 'story' : 'stories'} you submitted to someone else's book. You keep a copy here.`,
          hi: `${total} कहानियाँ जो आपने किसी की पुस्तक में जमा कीं। आपकी प्रति यहाँ रहती है।`,
        })}
      </p>

      {groups.map((group) => (
        <div key={group.inviteId} className="card px-4 pb-2">
          <div className="border-b border-heritage-line/60 py-3">
            <p className="font-serif text-base text-heritage-ink">{group.bookTitle}</p>
            {group.ownerName && (
              <p className="text-xs text-heritage-muted">
                {t({ en: 'For', hi: 'के लिए' })} {group.ownerName}
              </p>
            )}
          </div>
          {group.stories.map((story) => (
            <ContributorStoryRow
              key={story.id}
              story={story}
              inviteSlug={group.inviteSlug}
              bookTitle={group.bookTitle}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
