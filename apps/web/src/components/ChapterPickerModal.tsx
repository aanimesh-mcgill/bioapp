import { Modal } from '@/components/ui/Modal';
import { usePickText } from '@/context/UiLocaleContext';
import type { Chapter } from '@/types';

type ChapterPickerModalProps = {
  open: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterId?: string | null;
  storyTitle: string;
  onSelect: (chapterId: string) => void;
};

export function ChapterPickerModal({
  open,
  onClose,
  chapters,
  currentChapterId,
  storyTitle,
  onSelect,
}: ChapterPickerModalProps) {
  const t = usePickText();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <div>
          <p className="font-semibold text-brand-800">
            {t({ en: 'Choose a chapter', hi: 'अध्याय चुनें' })}
          </p>
          <p className="truncate text-sm font-normal text-slate-500">{storyTitle}</p>
        </div>
      }
    >
      {chapters.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t({ en: 'Add a chapter from the Book page first.', hi: 'पहले पुस्तक पृष्ठ से अध्याय जोड़ें।' })}
        </p>
      ) : (
        <div className="space-y-2">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                currentChapterId === chapter.id
                  ? 'border-brand-400 bg-brand-50 font-medium text-brand-800'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => {
                onSelect(chapter.id);
                onClose();
              }}
            >
              {chapter.title}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
