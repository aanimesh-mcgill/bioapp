import { useEffect, useState } from 'react';
import { BilingualBtn, BilingualLine, SectionHeading } from '@/components/BilingualText';
import { Modal } from '@/components/ui/Modal';
import { ClipList, ClipRecorder } from '@/components/ClipRecorder';
import { ImagePromptGuidedRecorder, PhotoPreview } from '@/components/ImagePromptGuidedRecorder';
import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';
import { usePickText } from '@/context/UiLocaleContext';
import { useStoryChapters } from '@/hooks/useStoryChapters';
import { StoryChapterRow } from '@/components/StoryChapterRow';
import {
  blockLabel,
  imageBlockClipOrder,
  resolveStoryBlocks,
  textBlockClipOrder,
} from '@/lib/storyBlocks';
import {
  addImageBlock,
  addTextBlock,
  deleteContentBlock,
  deleteBlockClip,
  ensureContentBlocksPersisted,
  reorderBlockClips,
  reorderImageBlockClips,
  reorderContentBlocks,
  updateClipLabel,
  updateTextBlock,
  updateImageBlockMeta,
  uploadBlockClip,
} from '@/services/storyBlocks';
import type { AudioClip, Chapter, StoryContentBlock, StoryImageBlock, StorySession } from '@/types';

interface StoryContentEditorProps {
  session: StorySession;
  clips: AudioClip[];
  userId: string;
  onFinish: () => void;
  finishing?: boolean;
}

type ModalKind = 'none' | 'add-text' | 'add-image' | 'record-text' | 'record-image';

export function StoryContentEditor({
  session,
  clips,
  userId,
  onFinish,
  finishing,
}: StoryContentEditorProps) {
  const t = usePickText();
  const {
    chapters,
    currentChapterId,
    chapterLabel,
    moving: movingChapter,
    moveToChapter,
  } = useStoryChapters(session);
  const { order, blocks, migrated } = resolveStoryBlocks(session);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(order[0] ?? null);
  const [modal, setModal] = useState<ModalKind>('none');
  const [adding, setAdding] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (migrated && !session.contentBlockOrder?.length && order.length > 0) {
      void ensureContentBlocksPersisted(session.id);
    }
  }, [session.id, migrated, session.contentBlockOrder?.length, order.length]);

  useEffect(() => {
    if (order.length > 0 && activeBlockId && !order.includes(activeBlockId)) {
      setActiveBlockId(order[0]);
    }
  }, [order, activeBlockId]);

  const recordBlock =
    modal === 'record-text' || modal === 'record-image'
      ? blocks[activeBlockId ?? '']
      : undefined;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const persistIfNeeded = async () => {
    if (migrated && !session.contentBlockOrder?.length) {
      await ensureContentBlocksPersisted(session.id);
    }
  };

  const closeModal = () => {
    if (!adding) setModal('none');
  };

  const handleMoveBlock = async (blockId: string, dir: 'up' | 'down') => {
    await persistIfNeeded();
    const idx = order.indexOf(blockId);
    if (idx < 0) return;
    const next = [...order];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    await reorderContentBlocks(session.id, next);
  };

  const handleDeleteBlock = async (blockId: string) => {
    const msg = t({
      en: 'Remove this section from the story?',
      hi: 'इस अनुभाग को हटाएं?',
    });
    if (!confirm(msg)) return;
    await persistIfNeeded();
    await deleteContentBlock(session.id, blockId);
    if (activeBlockId === blockId) setActiveBlockId(null);
  };

  const handleAddText = async (data: { content: string; date?: string; year?: number }) => {
    setAdding(true);
    try {
      await persistIfNeeded();
      const id = await addTextBlock(session.id, data);
      setActiveBlockId(id);
      setModal('none');
      showToast(t({ en: 'Text note added.', hi: 'टेक्स्ट नोट जोड़ा गया।' }));
    } finally {
      setAdding(false);
    }
  };

  const handleAddImage = async (data: { file: File; date?: string; year?: number; title?: string }) => {
    setAdding(true);
    try {
      await persistIfNeeded();
      const id = await addImageBlock(userId, session.id, { ...data, title: data.title ?? '' });
      setActiveBlockId(id);
      setModal('none');
      showToast(t({ en: 'Photo added.', hi: 'फोटो जोड़ी गई।' }));
    } finally {
      setAdding(false);
    }
  };

  const handlePhotoTitleChange = async (blockId: string, title: string) => {
    const trimmed = title.trim();
    await persistIfNeeded();
    await updateImageBlockMeta(session.id, blockId, { title: trimmed });
  };

  const handleTextClip = async (blockId: string, blob: Blob, duration: number) => {
    setRecordSaving(true);
    try {
      await persistIfNeeded();
      await uploadBlockClip(userId, session.id, blockId, blob, duration);
      showToast(t({ en: 'Clip saved!', hi: 'क्लिप सहेजी!' }));
    } finally {
      setRecordSaving(false);
    }
  };

  const handleReorderClips = async (blockId: string, clipOrder: string[]) => {
    await reorderBlockClips(session.id, blockId, clipOrder);
  };

  const handleReorderImageClips = async (blockId: string, block: StoryImageBlock, clipOrder: string[]) => {
    await reorderImageBlockClips(session.id, blockId, clipOrder);
  };

  const modalTitle =
    modal === 'add-text' || modal === 'record-text' ? (
      <SectionHeading
        en={modal === 'add-text' ? 'Add text note' : 'Record for text note'}
        hi={modal === 'add-text' ? 'टेक्स्ट नोट जोड़ें' : 'टेक्स्ट नोट के लिए रिकॉर्ड'}
      />
    ) : modal === 'add-image' || modal === 'record-image' ? (
      <SectionHeading
        en={modal === 'add-image' ? 'Add photo' : 'Record for photo'}
        hi={modal === 'add-image' ? 'फोटो जोड़ें' : 'फोटो के लिए रिकॉर्ड'}
      />
    ) : null;

  return (
    <div className="space-y-4">
      <Modal open={modal !== 'none'} onClose={closeModal} title={modalTitle} busy={adding || recordSaving} size="lg">
        {modal === 'add-text' && <TextStimulusForm onSubmit={handleAddText} submitting={adding} />}
        {modal === 'add-image' && <ImageMetadataForm onContinue={handleAddImage} submitting={adding} />}
        {modal === 'record-text' && recordBlock?.type === 'text' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 line-clamp-3">{recordBlock.content}</p>
            <ClipRecorder
              autoSave
              hasExistingClip={recordBlock.clipOrder.length > 0}
              onClipReady={async (blob, dur) => {
                await handleTextClip(recordBlock.id, blob, dur);
              }}
            />
            <button type="button" className="btn-secondary w-full" onClick={closeModal} disabled={recordSaving}>
              <BilingualBtn en={recordSaving ? 'Saving…' : 'Done'} hi={recordSaving ? 'सहेज रहे…' : 'हो गया'} />
            </button>
          </div>
        )}
        {modal === 'record-image' && recordBlock?.type === 'image' && (
          <ImagePromptGuidedRecorder
            sessionId={session.id}
            userId={userId}
            block={recordBlock as StoryImageBlock}
            clips={clips}
            embedded
            onFinish={closeModal}
          />
        )}
      </Modal>

      {order.length === 0 ? (
        <>
          <SectionHeading en="Build your story" hi="अपनी कहानी बनाएं" />
          <BilingualLine
            en="Add photos and text notes — each can have its own audio recordings."
            hi="फोटो और टेक्स्ट नोट जोड़ें — प्रत्येक की अपनी ऑडियो रिकॉर्डिंग हो सकती है।"
            enClass="text-sm text-slate-600"
            hiClass="text-xs text-slate-500"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={() => setModal('add-text')}>
              <BilingualBtn en="+ Text note" hi="+ टेक्स्ट" />
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setModal('add-image')}>
              <BilingualBtn en="+ Photo" hi="+ फोटो" />
            </button>
          </div>
        </>
      ) : (
        <>
          <SectionHeading en="Story content" hi="कहानी की सामग्री" />
          <BilingualLine
            en="Tap a section to expand. Use Record to add audio in a modal."
            hi="विस्तार के लिए अनुभाग दबाएं। ऑडियो जोड़ने के लिए रिकॉर्ड दबाएं।"
            enClass="text-sm text-slate-600"
            hiClass="text-xs text-slate-500"
          />
        </>
      )}

      {toast && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>
      )}

      {order.map((blockId, idx) => {
        const block = blocks[blockId];
        if (!block) return null;
        const isActive = activeBlockId === blockId;
        const clipOrder =
          block.type === 'text'
            ? textBlockClipOrder(block, clips, blocks)
            : imageBlockClipOrder(block, clips);
        const clipCount = clipOrder.length;

        return (
          <StoryBlockCard
            key={blockId}
            block={block}
            index={idx}
            total={order.length}
            clipCount={clipCount}
            clipOrder={clipOrder}
            isActive={isActive}
            clips={clips}
            onToggle={() => setActiveBlockId(isActive ? null : blockId)}
            onMoveUp={() => handleMoveBlock(blockId, 'up')}
            onMoveDown={() => handleMoveBlock(blockId, 'down')}
            onDelete={() => handleDeleteBlock(blockId)}
            onRecord={() => {
              setActiveBlockId(blockId);
              setModal(block.type === 'image' ? 'record-image' : 'record-text');
            }}
            onTextChange={(content) => updateTextBlock(session.id, blockId, { content })}
            onPhotoTitleChange={(title) => handlePhotoTitleChange(blockId, title)}
            onMoveClipUp={(clipId) => {
              if (block.type === 'text') {
                const o = [...textBlockClipOrder(block, clips, blocks)];
                const i = o.indexOf(clipId);
                if (i <= 0) return;
                [o[i - 1], o[i]] = [o[i], o[i - 1]];
                void handleReorderClips(blockId, o);
                return;
              }
              if (block.type === 'image') {
                const o = [...imageBlockClipOrder(block, clips)];
                const i = o.indexOf(clipId);
                if (i <= 0) return;
                [o[i - 1], o[i]] = [o[i], o[i - 1]];
                void handleReorderImageClips(blockId, block, o);
              }
            }}
            onMoveClipDown={(clipId) => {
              if (block.type === 'text') {
                const o = [...textBlockClipOrder(block, clips, blocks)];
                const i = o.indexOf(clipId);
                if (i < 0 || i >= o.length - 1) return;
                [o[i], o[i + 1]] = [o[i + 1], o[i]];
                void handleReorderClips(blockId, o);
                return;
              }
              if (block.type === 'image') {
                const o = [...imageBlockClipOrder(block, clips)];
                const i = o.indexOf(clipId);
                if (i < 0 || i >= o.length - 1) return;
                [o[i], o[i + 1]] = [o[i + 1], o[i]];
                void handleReorderImageClips(blockId, block, o);
              }
            }}
            onDeleteClip={(clipId) => void deleteBlockClip(session.id, blockId, clipId)}
            onLabelChange={(clipId, label) => void updateClipLabel(clipId, label)}
            chapters={chapters}
            currentChapterId={currentChapterId}
            chapterLabel={chapterLabel}
            movingChapter={movingChapter}
            onChapterChange={moveToChapter}
          />
        );
      })}

      {order.length > 0 && (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setModal('add-text')}>
            <BilingualBtn en="+ Text" hi="+ टेक्स्ट" />
          </button>
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setModal('add-image')}>
            <BilingualBtn en="+ Photo" hi="+ फोटो" />
          </button>
        </div>
      )}

      <button type="button" className="btn-primary w-full" onClick={onFinish} disabled={finishing}>
        {finishing ? (
          <BilingualBtn en="Submitting…" hi="जमा हो रहा…" />
        ) : (
          <BilingualBtn
            en={session.isContributorStory ? 'Submit story' : 'Finish & Generate Story'}
            hi={session.isContributorStory ? 'कहानी जमा करें' : 'समाप्त करें और कहानी बनाएं'}
          />
        )}
      </button>
    </div>
  );
}

interface StoryBlockCardProps {
  block: StoryContentBlock;
  index: number;
  total: number;
  clipCount: number;
  clipOrder: string[];
  isActive: boolean;
  clips: AudioClip[];
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRecord: () => void;
  onTextChange: (content: string) => void;
  onPhotoTitleChange: (title: string) => void;
  onMoveClipUp: (clipId: string) => void;
  onMoveClipDown: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onLabelChange: (clipId: string, label: string) => void;
  chapters: Chapter[];
  currentChapterId: string;
  chapterLabel: string;
  movingChapter?: boolean;
  onChapterChange: (chapterId: string) => void;
}

function StoryBlockCard({
  block,
  index,
  total,
  clipCount,
  clipOrder,
  isActive,
  clips,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRecord,
  onTextChange,
  onPhotoTitleChange,
  onMoveClipUp,
  onMoveClipDown,
  onDeleteClip,
  onLabelChange,
  chapters,
  currentChapterId,
  chapterLabel,
  movingChapter,
  onChapterChange,
}: StoryBlockCardProps) {
  const t = usePickText();
  const [editText, setEditText] = useState(block.type === 'text' ? block.content : '');
  const [editPhotoTitle, setEditPhotoTitle] = useState(block.type === 'image' ? block.title ?? '' : '');

  useEffect(() => {
    if (block.type === 'text') setEditText(block.content);
    if (block.type === 'image') setEditPhotoTitle(block.title ?? '');
  }, [block]);

  const clipLabel =
    clipCount > 0
      ? t({ en: `${clipCount} recording(s)`, hi: `${clipCount} रिकॉर्डिंग` })
      : t({ en: 'No recordings yet', hi: 'अभी कोई रिकॉर्डिंग नहीं' });

  return (
    <div className="card overflow-hidden">
      <StoryChapterRow
        chapters={chapters}
        currentChapterId={currentChapterId}
        chapterLabel={chapterLabel}
        moving={movingChapter}
        onChapterChange={onChapterChange}
        compact
      />
      <div className="mt-2 flex items-start gap-3">
        {block.type === 'image' && (
          <img src={block.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{block.type === 'image' ? '📷' : '📝'}</span>
            {block.type === 'image' && isActive ? (
              <input
                type="text"
                className="input-field min-w-0 flex-1 py-1 text-sm font-medium"
                value={editPhotoTitle}
                placeholder={t({ en: 'Photo title…', hi: 'फोटो शीर्षक…' })}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditPhotoTitle(e.target.value)}
                onBlur={() => onPhotoTitleChange(editPhotoTitle)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  e.stopPropagation();
                }}
                aria-label={t({ en: 'Photo title', hi: 'फोटो शीर्षक' })}
              />
            ) : block.type === 'text' && isActive ? (
              <input
                type="text"
                className="input-field min-w-0 flex-1 py-1 text-sm font-medium"
                value={editText}
                placeholder={t({ en: 'Prompt text…', hi: 'प्रश्न…' })}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => onTextChange(editText)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  e.stopPropagation();
                }}
                aria-label={t({ en: 'Prompt text', hi: 'प्रश्न' })}
              />
            ) : (
              <p className="font-medium text-slate-800">
                {block.type === 'image'
                  ? blockLabel(block, t({ en: 'Photo', hi: 'फोटो' }))
                  : blockLabel(block, t({ en: 'Text note', hi: 'टेक्स्ट नोट' }))}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {clipLabel}
            {(block.date || block.year) && ` · ${block.date ?? block.year}`}
          </p>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={onMoveUp} disabled={index === 0}>↑</button>
          <button type="button" className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={onMoveDown} disabled={index >= total - 1}>↓</button>
          <button type="button" className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50" onClick={onDelete}>✕</button>
        </div>
      </div>

      {isActive && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {block.type === 'image' && (
            <PhotoPreview block={block as StoryImageBlock} compact />
          )}

          <ClipList
            clips={clips}
            clipOrder={clipOrder}
            onMoveUp={onMoveClipUp}
            onMoveDown={onMoveClipDown}
            onDelete={onDeleteClip}
            onLabelChange={onLabelChange}
          />

          <button type="button" className="btn-primary w-full text-sm" onClick={onRecord}>
            <BilingualBtn en="Record clips" hi="क्लिप रिकॉर्ड करें" />
          </button>
        </div>
      )}
    </div>
  );
}
