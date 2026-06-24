import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ClipRecorder, ClipList } from '@/components/ClipRecorder';
import { StoryContentEditor } from '@/components/StoryContentEditor';
import { StoryNamePrompt, type StoryNameResult } from '@/components/StoryNamePrompt';
import { BilingualBtn, BilingualLine, BilingualStatus } from '@/components/BilingualText';
import { SESSION_STATUS } from '@/lib/bilingualUi';
import { shouldPromptPhotoStoryName } from '@/lib/photoStory';
import { composeBlocksReaderText, resolveStoryBlocks, storyHasRecordableContent } from '@/lib/storyBlocks';
import { hasAnyPromptContent } from '@/lib/imagePrompts';
import {
  subscribeToSession,
  subscribeToClips,
  uploadClip,
  reorderClips,
  deleteClip,
  markSessionComplete,
  markStimulusComplete,
  finishPhotoOnlyStory,
  applyPhotoStoryName,
  transcribeSpokenName,
} from '@/services/storySessions';
import { ensureContentBlocksPersisted } from '@/services/storyBlocks';
import type { StorySession, AudioClip } from '@/types';

export function StorySessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<StorySession | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [toast, setToast] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [namePromptStatus, setNamePromptStatus] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToSession(sessionId, setSession);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToClips(sessionId, setClips);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session) return;
    const { migrated } = resolveStoryBlocks(session);
    if (migrated && !session.contentBlockOrder?.length) {
      ensureContentBlocksPersisted(sessionId);
    }
  }, [sessionId, session]);

  const handleClipReady = async (blob: Blob, duration: number) => {
    if (!user || !sessionId || !session) return;
    const order = session.clipOrder.length;
    try {
      await uploadClip(user.uid, sessionId, blob, duration, order);
      setToast('Clip saved — listen above, then record more! / क्लिप सहेजी — ऊपर सुनें, फिर और रिकॉर्ड करें!');
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast('Failed to save clip. Try again. / क्लिप सहेजने में विफल।');
    }
  };

  const handleMoveUp = async (clipId: string) => {
    if (!session) return;
    const order = [...session.clipOrder];
    const idx = order.indexOf(clipId);
    if (idx <= 0) return;
    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    await reorderClips(session.id, order);
  };

  const handleMoveDown = async (clipId: string) => {
    if (!session) return;
    const order = [...session.clipOrder];
    const idx = order.indexOf(clipId);
    if (idx < 0 || idx >= order.length - 1) return;
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    await reorderClips(session.id, order);
  };

  const handleDelete = async (clipId: string) => {
    if (!session) return;
    await deleteClip(session.id, clipId, session.clipOrder);
  };

  const doFinish = async () => {
    if (!sessionId || !session || !user) return;

    const { order, blocks } = resolveStoryBlocks(session);
    const hasBlocks = storyHasRecordableContent(session, blocks, order);
    const hasLegacyImage =
      session.imageStimulus && hasAnyPromptContent(session.imageStimulus.prompts ?? {});
    const hasLegacyText = Boolean(session.textStimulus?.content?.trim());

    const blockReaderText = composeBlocksReaderText(blocks, order);
    const hasOnlyBlockContent =
      session.clipOrder.length === 0 &&
      (blockReaderText || hasLegacyImage || (order.length > 0 && hasBlocks));

    setFinishing(true);
    try {
      if (hasOnlyBlockContent && session.clipOrder.length === 0) {
        await finishPhotoOnlyStory(sessionId);
      } else {
        await markSessionComplete(sessionId);
      }

      if (session.stimulusId && !session.isContributorStory) {
        await markStimulusComplete(session.userId, session.stimulusId);
      }

      setToast('Story submitted — processing in background! / कहानी जमा — पृष्ठभूमि में प्रसंस्करण!');

      if (session.isContributorStory && session.contributorInviteId) {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const invSnap = await getDoc(doc(db, 'contributorInvites', session.contributorInviteId));
        const slug = invSnap.data()?.inviteSlug;
        navigate(slug ? `/contribute/${slug}/hub` : '/');
      } else {
        navigate('/stories');
      }
    } finally {
      setFinishing(false);
    }
  };

  const handleFinish = async () => {
    if (!sessionId || !session || !user) return;

    const { order, blocks } = resolveStoryBlocks(session);
    const hasBlocks = storyHasRecordableContent(session, blocks, order);
    const hasLegacyImage =
      session.imageStimulus && hasAnyPromptContent(session.imageStimulus.prompts ?? {});
    const hasLegacyText = Boolean(session.textStimulus?.content?.trim());

    if (!hasBlocks && !hasLegacyImage && !hasLegacyText && session.clipOrder.length === 0) {
      setToast('Add at least one recording or content section. / कम से कम एक रिकॉर्डिंग या अनुभाग जोड़ें।');
      return;
    }

    if (shouldPromptPhotoStoryName(session)) {
      setShowNamePrompt(true);
      return;
    }

    await doFinish();
  };

  const handleNameSubmit = async (result: StoryNameResult) => {
    if (!sessionId || !session || !user) return;

    setFinishing(true);
    setNamePromptStatus('');
    try {
      let name: string;
      if (result.type === 'text') {
        name = result.name;
      } else {
        setNamePromptStatus('Transcribing name… / नाम लिखा जा रहा है…');
        name = await transcribeSpokenName(user.uid, sessionId, result.blob, result.duration);
      }
      await applyPhotoStoryName(sessionId, session, name);
      setShowNamePrompt(false);
      await doFinish();
    } catch (err) {
      setNamePromptStatus(
        err instanceof Error ? err.message : 'Could not save name. Try typing. / नाम सहेज नहीं सके।',
      );
    } finally {
      setFinishing(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  const isProcessing = ['transcribing', 'generating'].includes(session.status);
  const hasDraft = ['ready', 'pending_approval', 'approved'].includes(session.status);
  const status = SESSION_STATUS[session.status];
  const { order } = resolveStoryBlocks(session);
  const useBlockEditor =
    !hasDraft &&
    (order.length > 0 ||
      session.sourceType === 'text_stimulus' ||
      session.sourceType === 'image_stimulus' ||
      session.sourceType === 'composite');

  return (
    <div className="px-4 py-6">
      <StoryNamePrompt
        open={showNamePrompt}
        busy={finishing}
        statusMessage={namePromptStatus}
        onCancel={() => {
          if (!finishing) {
            setShowNamePrompt(false);
            setNamePromptStatus('');
          }
        }}
        onSubmit={handleNameSubmit}
      />
      <Link to="/stories" className="mb-3 inline-block text-sm text-brand-600">
        ← My Stories / मेरी कहानियाँ
      </Link>

      {session.isContributorStory && (
        <div className="mb-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-800">
          From {session.contributorName} · {session.contributorRelationship}
          <span className="font-hindi block text-accent-700">
            {session.contributorName} से · {session.contributorRelationship}
          </span>
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-brand-600">{session.title}</h1>
        {status && (
          <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            <BilingualStatus en={status.en} hi={status.hi} />
          </span>
        )}
      </div>

      {session.stimulusPrompt && !useBlockEditor && (
        <div className="card mb-4 border-l-4 border-l-accent-400">
          <p className="text-sm leading-relaxed text-slate-700">{session.stimulusPrompt}</p>
        </div>
      )}

      {toast && (
        <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>
      )}

      {isProcessing && (
        <div className="card mb-4 flex items-center gap-2 text-sm text-amber-700">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
          <BilingualLine
            en="Transcription runs in the background — keep recording or start a new story!"
            hi="प्रतिलेखन पृष्ठभूमि में चल रहा है — रिकॉर्ड जारी रखें या नई कहानी शुरू करें!"
            enClass=""
            hiClass="text-xs text-amber-600"
          />
        </div>
      )}

      {useBlockEditor && user ? (
        <StoryContentEditor
          session={session}
          clips={clips}
          userId={user.uid}
          onFinish={handleFinish}
          finishing={finishing}
        />
      ) : (
        <>
          <ClipList
            clips={clips}
            clipOrder={session.clipOrder}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDelete={handleDelete}
          />

          {!hasDraft && (
            <div className="my-6">
              <ClipRecorder autoSave hasExistingClip={session.clipOrder.length > 0} onClipReady={handleClipReady} />
            </div>
          )}

          {session.clipOrder.length > 0 && !hasDraft && (
            <button type="button" className="btn-primary mb-4 w-full" onClick={handleFinish} disabled={finishing}>
              <BilingualBtn en="Finish & Generate Story" hi="समाप्त करें और कहानी बनाएं" />
            </button>
          )}
        </>
      )}

      {hasDraft && session.draft && (
        <div className="card mt-4">
          <BilingualLine
            en="Story Draft"
            hi="कहानी ड्राफ्ट"
            enClass="mb-2 text-sm font-semibold uppercase text-slate-500"
            hiClass="mb-2 text-xs text-slate-400"
          />
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {session.editedDraft ?? session.draft}
          </p>
          <Link to={`/stories/${session.id}`} className="mt-3 block text-sm font-semibold text-brand-600">
            Edit draft → / ड्राफ्ट संपादित करें →
          </Link>
        </div>
      )}

      {!hasDraft && !useBlockEditor && (
        <div className="text-center text-xs text-slate-400">
          <BilingualLine
            en="Add multiple short clips — they will be combined in order. Reorder with ↑↓."
            hi="कई छोटे क्लिप जोड़ें — वे क्रम में जुड़ेंगे। ↑↓ से क्रम बदलें।"
            enClass=""
            hiClass="text-slate-400"
          />
        </div>
      )}
    </div>
  );
}
