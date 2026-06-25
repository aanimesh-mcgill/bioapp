import { SectionHeading } from '@/components/BilingualText';
import { SpreadClipPlayer } from '@/components/SpreadClipPlayer';
import { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';
import { composeImageStoryReaderText, normalizePromptEntry } from '@/lib/imagePrompts';
import {
  blockLabel,
  clipsForBlock,
  imageBlockAsStimulus,
  resolveStoryBlocks,
} from '@/lib/storyBlocks';
import type { AudioClip, StoryContentBlock, StorySession } from '@/types';

function BlockReaderText({ block }: { block: StoryContentBlock }) {
  if (block.type === 'text') {
    if (!block.content.trim()) return null;
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{block.content}</div>
    );
  }

  const readerText = composeImageStoryReaderText(imageBlockAsStimulus(block));
  if (readerText.trim()) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{readerText}</div>
    );
  }

  const answered = IMAGE_PROMPT_QUESTIONS.map(({ key, label, labelHi }) => {
    const entry = normalizePromptEntry(block.prompts[key]);
    const text = entry.finalText?.trim() || entry.draftText?.trim();
    if (!text) return null;
    return (
      <div key={key}>
        <p className="text-xs font-semibold text-slate-500">
          {label} / {labelHi}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{text}</p>
      </div>
    );
  }).filter(Boolean);

  if (answered.length === 0) return null;
  return <div className="space-y-3">{answered}</div>;
}

export function StoryContentView({
  session,
  clips,
}: {
  session: StorySession;
  clips: AudioClip[];
}) {
  const { order, blocks } = resolveStoryBlocks(session);
  if (order.length === 0) return null;

  return (
    <section className="mb-4 space-y-4">
      <SectionHeading en="Story content" hi="कहानी की सामग्री" />

      {order.map((blockId, index) => {
        const block = blocks[blockId];
        if (!block) return null;

        const blockClips = clipsForBlock(clips, block, blocks).filter((c) => c.audioUrl);
        const label = blockLabel(block);

        return (
          <article key={blockId} className="card space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {block.type === 'image' ? `📷 ${label}` : `📝 ${label || `Section ${index + 1}`}`}
            </p>

            {block.type === 'image' && block.imageUrl && (
              <img
                src={block.imageUrl}
                alt={block.title || 'Photo'}
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
            )}

            {block.type === 'image' && (block.title || block.date || block.year) && (
              <div>
                {block.title?.trim() && <p className="font-medium text-slate-800">{block.title}</p>}
                {(block.date || block.year) && (
                  <p className="text-xs text-slate-500">{block.date ?? block.year}</p>
                )}
              </div>
            )}

            <BlockReaderText block={block} />

            {blockClips.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <SpreadClipPlayer clips={blockClips} />
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
