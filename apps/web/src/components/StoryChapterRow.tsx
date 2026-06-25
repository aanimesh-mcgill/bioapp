import { T } from '@/components/BilingualText';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import type { Chapter } from '@/types';

export function StoryChapterRow({
  chapters,
  currentChapterId,
  chapterLabel,
  moving,
  onChapterChange,
  compact = false,
}: {
  chapters: Chapter[];
  currentChapterId: string;
  chapterLabel: string;
  moving?: boolean;
  onChapterChange: (chapterId: string) => void;
  compact?: boolean;
}) {
  const t = usePickText();
  const { locale } = useUiLocale();

  if (chapters.length === 0) {
    return (
      <p className={`text-xs text-slate-400 ${locale === 'hi' ? 'font-hindi' : ''}`}>
        {t({ en: 'No chapters yet — add one in Book settings.', hi: 'अभी कोई अध्याय नहीं — पुस्तक सेटिंग्स में जोड़ें।' })}
      </p>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${compact ? '' : 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2'}`}
    >
      <span className={`shrink-0 text-xs font-medium text-slate-500 ${locale === 'hi' ? 'font-hindi' : ''}`}>
        <T en="Chapter" hi="अध्याय" />
      </span>
      <select
        className={`input-field min-w-0 flex-1 ${compact ? 'py-1 text-xs' : 'text-sm'}`}
        value={currentChapterId}
        disabled={moving}
        onChange={(e) => {
          const next = e.target.value;
          if (next && next !== currentChapterId) onChapterChange(next);
        }}
      >
        {!currentChapterId && (
          <option value="" disabled>
            {chapterLabel}
          </option>
        )}
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.title}
          </option>
        ))}
      </select>
    </div>
  );
}
