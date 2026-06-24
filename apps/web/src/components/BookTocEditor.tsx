import { Link } from 'react-router-dom';
import { SectionHeading, BilingualBtn, BilingualLine } from '@/components/BilingualText';
import { storyTimelineMs } from '@/lib/storyTimeline';
import { updateStoryTitle } from '@/services/storySessions';
import type { Book, Chapter, StorySession } from '@/types';

interface BookTocEditorProps {
  book: Book;
  chapters: Chapter[];
  stories: StorySession[];
  userId: string;
  newChapterTitle: string;
  onNewChapterTitleChange: (v: string) => void;
  onAddChapter: () => void;
  addingChapter?: boolean;
  onMoveChapter: (chapterId: string, direction: 'up' | 'down') => void;
  onMoveStoryInChapter: (chapterId: string, storyId: string, dir: 'up' | 'down') => void;
  onAssignStory: (storyId: string, chapterId: string) => void;
  onAutoSortChapter: (chapterId: string) => void;
  onUpdateChapterTitle: (chapterId: string, title: string) => void;
}

const READY_STATUSES = ['ready', 'pending_approval', 'approved', 'transcribing', 'generating', 'recording'];

function formatStoryDate(story: StorySession): string {
  const ms = storyTimelineMs(story);
  const d = new Date(ms);
  if (story.imageStimulus?.date || story.textStimulus?.date) {
    return d.toLocaleDateString();
  }
  if (story.imageStimulus?.year || story.textStimulus?.year) {
    return String(story.imageStimulus?.year ?? story.textStimulus?.year);
  }
  return d.toLocaleDateString();
}

export function BookTocEditor({
  book,
  chapters,
  stories,
  newChapterTitle,
  onNewChapterTitleChange,
  onAddChapter,
  addingChapter,
  onMoveChapter,
  onMoveStoryInChapter,
  onAssignStory,
  onAutoSortChapter,
  onUpdateChapterTitle,
}: BookTocEditorProps) {
  const readyStories = stories.filter((s) => READY_STATUSES.includes(s.status));

  const assignedIds = new Set(chapters.flatMap((c) => c.storyOrder));
  const unassigned = readyStories.filter((s) => !assignedIds.has(s.id));

  const orderedChapters = book.chapterOrder
    .map((id) => chapters.find((c) => c.id === id))
    .filter(Boolean) as Chapter[];

  return (
    <div className="space-y-4">
      <SectionHeading en="Table of Contents" hi="विषय सूची" />
      <BilingualLine
        en="Create chapters, assign stories, and arrange order. Move stories between chapters anytime using the chapter menu on each story."
        hi="अध्याय बनाएं, कहानियाँ असाइन करें, क्रम व्यवस्थित करें। किसी भी कहानी के अध्याय मेनू से दूसरे अध्याय में ले जा सकते हैं।"
        enClass="text-sm text-slate-600"
        hiClass="text-xs text-slate-500"
      />

      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="New chapter title / नया अध्याय शीर्षक"
          value={newChapterTitle}
          onChange={(e) => onNewChapterTitleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddChapter()}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={onAddChapter}
          disabled={addingChapter || !newChapterTitle.trim()}
        >
          {addingChapter ? (
            <BilingualBtn en="Adding…" hi="जोड़ रहे…" />
          ) : (
            <BilingualBtn en="Add Chapter" hi="अध्याय जोड़ें" />
          )}
        </button>
      </div>

      {orderedChapters.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          No chapters yet — add one above. / अभी कोई अध्याय नहीं — ऊपर जोड़ें।
        </p>
      )}

      {orderedChapters.map((chapter) => {
        const chapterStories = chapter.storyOrder
          .map((id) => stories.find((s) => s.id === id))
          .filter(Boolean) as StorySession[];

        return (
          <div key={chapter.id} className="card">
            <div className="mb-2 flex items-center gap-2">
              <input
                className="input-field flex-1 font-semibold"
                defaultValue={chapter.title}
                onBlur={(e) => onUpdateChapterTitle(chapter.id, e.target.value)}
              />
              <button type="button" className="px-2 text-slate-400" onClick={() => onMoveChapter(chapter.id, 'up')} aria-label="Move chapter up">↑</button>
              <button type="button" className="px-2 text-slate-400" onClick={() => onMoveChapter(chapter.id, 'down')} aria-label="Move chapter down">↓</button>
            </div>
            <button
              type="button"
              className="mb-3 text-xs font-semibold text-brand-600"
              onClick={() => onAutoSortChapter(chapter.id)}
            >
              Sort by date / created / तारीख या बनाने के समय से क्रम
            </button>

            {chapterStories.length === 0 ? (
              <p className="text-xs text-slate-400">No stories in this chapter yet. / इस अध्याय में अभी कोई कहानी नहीं।</p>
            ) : (
              chapterStories.map((story, idx) => (
                <div key={story.id} className="border-t border-slate-100 py-2 first:border-t-0">
                  {story.isContributorStory && (
                    <span className="mb-1 inline-block rounded-full bg-accent-100 px-2 py-0.5 text-[10px] text-accent-700">
                      {story.contributorName} · {story.contributorRelationship}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <input
                        className="input-field w-full text-sm"
                        defaultValue={story.title}
                        onBlur={(e) => updateStoryTitle(story.id, e.target.value)}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-400">{formatStoryDate(story)}</p>
                    </div>
                    <label className="sr-only" htmlFor={`chapter-${story.id}`}>
                      Move to chapter / अध्याय बदलें
                    </label>
                    <select
                      id={`chapter-${story.id}`}
                      className="input-field w-full text-xs sm:w-36"
                      value={chapter.id}
                      onChange={(e) => {
                        if (e.target.value !== chapter.id) {
                          onAssignStory(story.id, e.target.value);
                        }
                      }}
                    >
                      {orderedChapters.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <button type="button" className="text-xs text-slate-400" onClick={() => onMoveStoryInChapter(chapter.id, story.id, 'up')} disabled={idx === 0}>↑</button>
                    <button type="button" className="text-xs text-slate-400" onClick={() => onMoveStoryInChapter(chapter.id, story.id, 'down')} disabled={idx === chapterStories.length - 1}>↓</button>
                    <Link to={`/stories/${story.id}`} className="text-xs text-brand-600">Edit</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <section>
          <SectionHeading en="Unassigned Stories" hi="असाइन न की गई कहानियाँ" />
          <BilingualLine
            en="These stories are not in any chapter yet. Pick a chapter for each."
            hi="ये कहानियाँ अभी किसी अध्याय में नहीं हैं। प्रत्येक के लिए अध्याय चुनें।"
            enClass="mb-3 text-xs text-slate-500"
            hiClass="mb-3 text-xs text-slate-400"
          />
          <div className="space-y-2">
            {unassigned.map((story) => (
              <div key={story.id} className="card flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{story.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {formatStoryDate(story)} · {story.status.replace('_', ' ')}
                  </p>
                  {story.isContributorStory && (
                    <p className="text-xs text-accent-700">
                      {story.contributorName} · {story.contributorRelationship}
                    </p>
                  )}
                </div>
                <select
                  className="input-field w-full text-xs sm:w-44"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onAssignStory(story.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="" disabled>
                    Assign to chapter… / अध्याय चुनें…
                  </option>
                  {orderedChapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <Link to={`/stories/${story.id}`} className="text-xs font-semibold text-brand-600">
                  Review / देखें
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
