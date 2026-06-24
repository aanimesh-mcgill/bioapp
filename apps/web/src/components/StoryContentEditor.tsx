import { useState } from 'react';
import { BilingualBtn, BilingualLine, SectionHeading } from '@/components/BilingualText';
import { ClipList, ClipRecorder } from '@/components/ClipRecorder';
import { ImagePromptGuidedRecorder } from '@/components/ImagePromptGuidedRecorder';
import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';
import { blockLabel, clipsForBlock, resolveStoryBlocks, textBlockClipOrder } from '@/lib/storyBlocks';
import {
  addImageBlock,
  addTextBlock,
  deleteContentBlock,
  deleteBlockClip,
  ensureContentBlocksPersisted,
  reorderBlockClips,
  reorderContentBlocks,
  updateTextBlock,
  uploadBlockClip,
} from '@/services/storyBlocks';
import type { AudioClip, StoryContentBlock, StorySession } from '@/types';

interface StoryContentEditorProps {
  session: StorySession;
  clips: AudioClip[];
  userId: string;
  onFinish: () => void;
  finishing?: boolean;
}

type AddMode = 'none' | 'text' | 'image';

export function StoryContentEditor({
  session,
  clips,
  userId,
  onFinish,
  finishing,
}: StoryContentEditorProps) {
  const { order, blocks, migrated } = resolveStoryBlocks(session);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(order[0] ?? null);
  const [addMode, setAddMode] = useState<AddMode>('none');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const persistIfNeeded = async () => {
    if (migrated && !session.contentBlockOrder?.length) {
      await ensureContentBlocksPersisted(session.id);
    }
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
    if (!confirm('Remove this section from the story? / इस अनुभाग को हटाएं?')) return;
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
      setAddMode('none');
      showToast('Text note added. / टेक्स्ट नोट जोड़ा गया।');
    } finally {
      setAdding(false);
    }
  };

  const handleAddImage = async (data: { file: File; date?: string; year?: number }) => {
    setAdding(true);
    try {
      await persistIfNeeded();
      const id = await addImageBlock(userId, session.id, { ...data, title: '' });
      setActiveBlockId(id);
      setAddMode('none');
      showToast('Photo added. / फोटो जोड़ी गई।');
    } finally {
      setAdding(false);
    }
  };

  const handleTextClip = async (blockId: string, blob: Blob, duration: number) => {
    await persistIfNeeded();
    await uploadBlockClip(userId, session.id, blockId, blob, duration);
    showToast('Clip saved — listen above! / क्लिप सहेजी — ऊपर सुनें!');
  };

  const handleReorderClips = async (blockId: string, clipOrder: string[]) => {
    await reorderBlockClips(session.id, blockId, clipOrder);
  };

  const handleDeleteClip = async (blockId: string, clipId: string, clipOrder: string[]) => {
    await deleteBlockClip(session.id, blockId, clipId);
    await handleReorderClips(blockId, clipOrder.filter((id) => id !== clipId));
  };

  if (order.length === 0 && addMode === 'none') {
    return (
      <div className="space-y-4">
        <SectionHeading en="Build your story" hi="अपनी कहानी बनाएं" />
        <BilingualLine
          en="Add photos and text notes — each can have its own audio recordings."
          hi="फोटो और टेक्स्ट नोट जोड़ें — प्रत्येक की अपनी ऑडियो रिकॉर्डिंग हो सकती है।"
          enClass="text-sm text-slate-600"
          hiClass="text-xs text-slate-500"
        />
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={() => setAddMode('text')}>
            <BilingualBtn en="+ Text note" hi="+ टेक्स्ट" />
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => setAddMode('image')}>
            <BilingualBtn en="+ Photo" hi="+ फोटो" />
          </button>
        </div>
        {addMode === 'text' && <TextStimulusForm onSubmit={handleAddText} submitting={adding} />}
        {addMode === 'image' && <ImageMetadataForm onContinue={handleAddImage} submitting={adding} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading en="Story content" hi="कहानी की सामग्री" />
      <BilingualLine
        en="Reorder sections with ↑↓. Tap a section to record or edit."
        hi="↑↓ से क्रम बदलें। रिकॉर्ड या संपादित करने के लिए अनुभाग दबाएं।"
        enClass="text-sm text-slate-600"
        hiClass="text-xs text-slate-500"
      />

      {toast && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>
      )}

      {order.map((blockId, idx) => {
        const block = blocks[blockId];
        if (!block) return null;
        const isActive = activeBlockId === blockId;
        const blockClips = clipsForBlock(clips, block);
        const clipCount = blockClips.length;

        return (
          <StoryBlockCard
            key={blockId}
            block={block}
            index={idx}
            total={order.length}
            clipCount={clipCount}
            isActive={isActive}
            clips={clips}
            sessionId={session.id}
            userId={userId}
            onToggle={() => setActiveBlockId(isActive ? null : blockId)}
            onMoveUp={() => handleMoveBlock(blockId, 'up')}
            onMoveDown={() => handleMoveBlock(blockId, 'down')}
            onDelete={() => handleDeleteBlock(blockId)}
            onTextChange={(content) => updateTextBlock(session.id, blockId, { content })}
            onTextClip={(blob, dur) => handleTextClip(blockId, blob, dur)}
            onMoveClipUp={(clipId) => {
              if (block.type !== 'text') return;
              const o = [...block.clipOrder];
              const i = o.indexOf(clipId);
              if (i <= 0) return;
              [o[i - 1], o[i]] = [o[i], o[i - 1]];
              handleReorderClips(blockId, o);
            }}
            onMoveClipDown={(clipId) => {
              if (block.type !== 'text') return;
              const o = [...block.clipOrder];
              const i = o.indexOf(clipId);
              if (i < 0 || i >= o.length - 1) return;
              [o[i], o[i + 1]] = [o[i + 1], o[i]];
              handleReorderClips(blockId, o);
            }}
            onDeleteClip={(clipId) => handleDeleteClip(blockId, clipId, block.type === 'text' ? block.clipOrder : [])}
          />
        );
      })}

      {addMode === 'none' ? (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setAddMode('text')}>
            <BilingualBtn en="+ Add text note" hi="+ टेक्स्ट जोड़ें" />
          </button>
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setAddMode('image')}>
            <BilingualBtn en="+ Add photo" hi="+ फोटो जोड़ें" />
          </button>
        </div>
      ) : (
        <div className="card">
          <button type="button" className="mb-3 text-sm text-brand-600" onClick={() => setAddMode('none')}>
            ← Cancel / रद्द
          </button>
          {addMode === 'text' ? (
            <TextStimulusForm onSubmit={handleAddText} submitting={adding} />
          ) : (
            <ImageMetadataForm onContinue={handleAddImage} submitting={adding} />
          )}
        </div>
      )}

      <button type="button" className="btn-primary w-full" onClick={onFinish} disabled={finishing}>
        {finishing ? (
          <BilingualBtn en="Submitting…" hi="जमा हो रहा…" />
        ) : (
          <BilingualBtn en="Finish & Generate Story" hi="समाप्त करें और कहानी बनाएं" />
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
  isActive: boolean;
  clips: AudioClip[];
  sessionId: string;
  userId: string;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onTextChange: (content: string) => void;
  onTextClip: (blob: Blob, duration: number) => void;
  onMoveClipUp: (clipId: string) => void;
  onMoveClipDown: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
}

function StoryBlockCard({
  block,
  index,
  total,
  clipCount,
  isActive,
  clips,
  sessionId,
  userId,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
  onTextChange,
  onTextClip,
  onMoveClipUp,
  onMoveClipDown,
  onDeleteClip,
}: StoryBlockCardProps) {
  const [editText, setEditText] = useState(block.type === 'text' ? block.content : '');

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={onToggle}
      >
        <span className="text-xl">{block.type === 'image' ? '📷' : '📝'}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">{blockLabel(block)}</p>
          <p className="text-xs text-slate-500">
            {clipCount > 0 ? `${clipCount} recording(s) / रिकॉर्डिंग` : 'No recordings yet / अभी कोई रिकॉर्डिंग नहीं'}
            {(block.date || block.year) && ` · ${block.date ?? block.year}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={onMoveUp} disabled={index === 0}>↑</button>
          <button type="button" className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={onMoveDown} disabled={index >= total - 1}>↓</button>
          <button type="button" className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50" onClick={onDelete}>✕</button>
        </div>
      </button>

      {isActive && block.type === 'text' && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <textarea
            className="input-field min-h-[80px] text-sm"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => onTextChange(editText)}
          />
          <ClipList
            clips={clips}
            clipOrder={block.type === 'text' ? textBlockClipOrder(block, clips) : block.clipOrder}
            onMoveUp={onMoveClipUp}
            onMoveDown={onMoveClipDown}
            onDelete={onDeleteClip}
          />
          <ClipRecorder autoSave hasExistingClip={clipCount > 0} onClipReady={onTextClip} />
        </div>
      )}

      {isActive && block.type === 'image' && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <ImagePromptGuidedRecorder
            sessionId={sessionId}
            userId={userId}
            block={block}
            clips={clips}
            embedded
          />
        </div>
      )}
    </div>
  );
}
