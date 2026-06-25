import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { toIsoString } from '@/lib/firestoreUtils';
import { composeBlocksReaderText, resolveStoryBlocks } from '@/lib/storyBlocks';
import { getOrCreateAlbumBookForCollab, getAlbumBookBundleForCollab } from '@/services/books';
import type {
  AudioClip,
  Chapter,
  PromptType,
  PublicBookSnapshot,
  StorySession,
} from '@/types';

function storyDisplayContent(session: StorySession): string {
  const draft = session.editedDraft ?? session.draft;
  if (draft?.trim()) return draft.trim();

  const transcript = session.editedTranscript ?? session.combinedTranscript?.text;
  if (transcript?.trim()) return transcript.trim();

  const { order, blocks } = resolveStoryBlocks(session);
  const fromBlocks = composeBlocksReaderText(blocks, order);
  if (fromBlocks.trim()) return fromBlocks;

  if (session.textStimulus?.content?.trim()) return session.textStimulus.content.trim();
  if (session.stimulusPrompt?.trim()) return session.stimulusPrompt.trim();
  return '';
}

function storyImageUrls(session: StorySession): string[] {
  const urls: string[] = [];
  const { order, blocks } = resolveStoryBlocks(session);
  for (const id of order) {
    const block = blocks[id];
    if (block?.type === 'image' && block.imageUrl && !urls.includes(block.imageUrl)) {
      urls.push(block.imageUrl);
    }
  }
  if (session.imageStimulus?.imageUrl && !urls.includes(session.imageStimulus.imageUrl)) {
    urls.push(session.imageStimulus.imageUrl);
  }
  return urls;
}

function storyAuthorName(session: StorySession, fallback: string): string {
  if (session.contributorName?.trim()) return session.contributorName.trim();
  return fallback;
}

function orderStoriesByChapters(chapters: Chapter[], stories: StorySession[]): Array<{
  session: StorySession;
  chapterTitle?: string;
}> {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const ordered: Array<{ session: StorySession; chapterTitle?: string }> = [];
  const seen = new Set<string>();

  for (const chapter of chapters) {
    for (const storyId of chapter.storyOrder) {
      const session = byId.get(storyId);
      if (!session || seen.has(session.id)) continue;
      seen.add(session.id);
      ordered.push({ session, chapterTitle: chapter.title });
    }
  }

  for (const session of stories) {
    if (!seen.has(session.id)) {
      ordered.push({ session, chapterTitle: undefined });
    }
  }

  return ordered;
}

async function clipAudioUrl(clip: AudioClip): Promise<string> {
  if (clip.audioUrl?.trim()) return clip.audioUrl;
  if (!clip.storagePath?.trim()) return '';
  try {
    return await getDownloadURL(ref(storage, clip.storagePath));
  } catch {
    return '';
  }
}

function clipPromptType(session: StorySession | undefined): PromptType {
  if (session?.sourceType === 'image_stimulus') return 'image';
  return 'text';
}

export async function buildPublicBrowseSnapshot(
  collabBook: { id: string; title: string; description?: string },
  ownerId: string,
  authorName: string,
): Promise<Omit<PublicBookSnapshot, 'id' | 'shareToken'>> {
  const album = await getOrCreateAlbumBookForCollab(ownerId, collabBook, authorName);
  const resolvedAuthor =
    authorName.trim() && !/^[a-zA-Z0-9]{20,}$/.test(authorName.trim())
      ? authorName.trim()
      : album.authorName;
  const { chapters, stories, clips } = await getAlbumBookBundleForCollab(ownerId, collabBook, resolvedAuthor);
  const ordered = orderStoriesByChapters(chapters, stories);
  const storyById = new Map(stories.map((s) => [s.id, s]));

  const snapshotStories = ordered.map(({ session, chapterTitle }) => {
    const images = storyImageUrls(session);
    return {
      id: session.id,
      title: session.title,
      content: storyDisplayContent(session),
      imageUrl: images[0],
      imageUrls: images.length > 0 ? images : undefined,
      authorName: storyAuthorName(session, album.authorName),
      chapterTitle,
      createdAt: toIsoString(session.updatedAt),
    };
  });

  const snapshotClips: PublicBookSnapshot['audioClips'] = [];
  for (const clip of clips) {
    if (clip.errorMessage === 'removed') continue;
    const audioUrl = await clipAudioUrl(clip);
    if (!audioUrl) continue;
    const session = storyById.get(clip.storySessionId);
    snapshotClips.push({
      id: clip.id,
      promptType: clipPromptType(session),
      promptText: clip.label?.trim() || session?.title || 'Recording',
      imageUrl: session ? storyImageUrls(session)[0] : undefined,
      audioUrl,
      createdByName: session ? storyAuthorName(session, album.authorName) : album.authorName,
      createdAt: toIsoString(clip.createdAt),
    });
  }

  // Legacy collab-only stories still stored in bookStories (append if any)
  // handled in refreshPublicBookSnapshot merge

  return {
    albumBookId: album.id,
    bookId: collabBook.id,
    bookTitle: collabBook.title,
    description: collabBook.description ?? album.title,
    stories: snapshotStories,
    audioClips: snapshotClips,
    chapters: chapters.map((c) => ({
      id: c.id,
      title: c.title,
      storyIds: c.storyOrder,
    })),
    updatedAt: new Date(),
  };
}
