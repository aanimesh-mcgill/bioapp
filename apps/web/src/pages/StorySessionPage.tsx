import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { ClipRecorder, ClipList } from '@/components/ClipRecorder';
import { StoryContentEditor } from '@/components/StoryContentEditor';
import { ChapterAssignSheet } from '@/components/heritage/ChapterAssignSheet';
import { StoryNamePrompt, type StoryNameResult } from '@/components/StoryNamePrompt';
import { useStoryChapters } from '@/hooks/useStoryChapters';
import { BilingualBtn, BilingualLine, BilingualStatus, T } from '@/components/BilingualText';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { SESSION_STATUS } from '@/lib/bilingualUi';
import { shouldPromptPhotoStoryName, PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';
import { composeBlocksReaderText, resolveStoryBlocks, storyHasRecordableContent } from '@/lib/storyBlocks';
import { hasAnyPromptContent } from '@/lib/imagePrompts';
import { isContributorStorySubmitted } from '@/lib/contributorStories';
import { userDisplayName } from '@/lib/userDisplayName';
import {
  subscribeToSession,
  subscribeToClips,
  uploadClip,
  reorderClips,
  deleteClip,
  markSessionComplete,
  markStimulusComplete,
  finishPhotoOnlyStory,
  markContributorStorySubmitted,
  applyPhotoStoryName,
  transcribeSpokenName,
  updateStoryTitle,
} from '@/services/storySessions';
import { ensureContentBlocksPersisted, updateClipLabel } from '@/services/storyBlocks';
import { completeBookPhoto, completeBookPhotoForStory } from '@/services/bookPhotos';
import type { StorySession, AudioClip } from '@/types';

export function StorySessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const navigate = useNavigate();
  const location = useLocation();
  const t = usePickText();
  const { locale } = useUiLocale();

  const [session, setSession] = useState<StorySession | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [toast, setToast] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [namePromptStatus, setNamePromptStatus] = useState('');
  const [showChapterSheet, setShowChapterSheet] = useState(false);
  const [assigningChapter, setAssigningChapter] = useState(false);
  const [editStoryTitle, setEditStoryTitle] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToSession(sessionId, setSession);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToClips(sessionId, setClips);
  }, [sessionId]);

  const contributeSlug = useMemo(() => {
    const match = location.pathname.match(/^\/contribute\/([^/]+)\/story\//);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const photoReturn = useMemo(() => {
    const state = location.state as
      | { returnTo?: string; bookPhotoId?: string; bookId?: string }
      | null;
    if (state?.returnTo && state.bookPhotoId && state.bookId) {
      return state;
    }
    return null;
  }, [location.state]);

  useEffect(() => {
    if (session) setEditStoryTitle(session.title);
  }, [session?.id, session?.title]);

  useEffect(() => {
    if (!session || !sessionId || !session.isContributorStory) return;
    if (!isContributorStorySubmitted(session)) return;
    navigate(`/stories/${sessionId}`, {
      replace: true,
      state: contributeSlug ? { fromContributeHub: `/contribute/${contributeSlug}/hub` } : undefined,
    });
  }, [session, sessionId, contributeSlug, navigate]);

  useEffect(() => {
    if (!sessionId || !session) return;
    const { migrated } = resolveStoryBlocks(session);
    if (migrated && !session.contentBlockOrder?.length) {
      ensureContentBlocksPersisted(sessionId);
    }
  }, [sessionId, session]);

  const handleStoryTitleBlur = async () => {
    if (!session) return;
    const trimmed = editStoryTitle.trim();
    const next = trimmed || PHOTO_STORY_PLACEHOLDER;
    if (next === session.title) return;
    await updateStoryTitle(session.id, next);
  };

  const handleClipReady = async (blob: Blob, duration: number) => {
    if (!user || !sessionId || !session) return;
    const order = session.clipOrder.length;
    try {
      await uploadClip(user.uid, sessionId, blob, duration, order);
      setToast(
        t({
          en: 'Clip saved — listen above, then record more!',
          hi: 'क्लिप सहेजी — ऊपर सुनें, फिर और रिकॉर्ड करें!',
        }),
      );
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast(t({ en: 'Failed to save clip. Try again.', hi: 'क्लिप सहेजने में विफल।' }));
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

  const hubPath = contributeSlug ? `/contribute/${contributeSlug}/hub` : '/stories';

  const {
    chapters,
    currentChapterId,
    chapterLabel,
    moving: movingChapter,
    moveToChapter,
  } = useStoryChapters(session);

  const finishNavigate = async () => {
    if (!session) return;
    if (photoReturn) {
      await completeBookPhoto(photoReturn.bookId!, photoReturn.bookPhotoId!);
      navigate(photoReturn.returnTo ?? '/', { replace: true });
      return;
    }
    const collabBookId = session.collabBookId ?? activeBook?.id;
    if (collabBookId && sessionId) {
      await completeBookPhotoForStory(collabBookId, sessionId);
    }
    if (session.isContributorStory) {
      if (contributeSlug) {
        navigate(`/contribute/${contributeSlug}/hub`);
        return;
      }
      if (session.contributorInviteId) {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const invSnap = await getDoc(doc(db, 'contributorInvites', session.contributorInviteId));
        const slug = invSnap.data()?.inviteSlug;
        navigate(slug ? `/contribute/${slug}/hub` : '/contribute');
        return;
      }
      navigate('/contribute');
    } else {
      navigate('/stories');
    }
  };

  const doFinish = async () => {
    if (!sessionId || !session || !user) return;

    const { order, blocks } = resolveStoryBlocks(session);
    const hasBlocks = storyHasRecordableContent(session, blocks, order);
    const hasLegacyImage =
      session.imageStimulus && hasAnyPromptContent(session.imageStimulus.prompts ?? {});

    const blockReaderText = composeBlocksReaderText(blocks, order);
    const hasOnlyBlockContent =
      session.clipOrder.length === 0 &&
      (blockReaderText || hasLegacyImage || (order.length > 0 && hasBlocks));

    setFinishing(true);
    try {
      if (session.isContributorStory) {
        await markContributorStorySubmitted(sessionId);
      }

      if (hasOnlyBlockContent && session.clipOrder.length === 0) {
        await finishPhotoOnlyStory(sessionId);
      } else {
        await markSessionComplete(sessionId);
      }

      if (session.stimulusId && !session.isContributorStory) {
        const collabId = session.collabBookId ?? activeBook?.id;
        await markStimulusComplete(
          user.uid,
          session.stimulusId,
          session.bookId,
          collabId,
        );
      }

      const collabBookId = session.collabBookId ?? activeBook?.id;
      if (collabBookId && sessionId) {
        await completeBookPhotoForStory(collabBookId, sessionId);
      }

      setToast(
        session.isContributorStory
          ? t({
              en: 'Story submitted to the book owner. You can still view it in your stories.',
              hi: 'कहानी पुस्तक स्वामी को भेज दी गई। आप इसे अपनी कहानियों में देख सकते हैं।',
            })
          : t({
              en: 'Story submitted — choose a chapter next.',
              hi: 'कहानी जमा — अब अध्याय चुनें।',
            }),
      );

      if (session.isContributorStory) {
        await finishNavigate();
      } else if (activeBook && chapters.length > 0) {
        setShowChapterSheet(true);
      } else {
        await finishNavigate();
      }
    } catch (err) {
      console.error('finish story failed:', err);
      setToast(
        t({
          en: 'Could not finish story. Check your connection and try again.',
          hi: 'कहानी पूरी नहीं हो सकी। कनेक्शन जाँचें और फिर कोशिश करें।',
        }),
      );
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
      setToast(
        t({
          en: 'Add at least one recording or content section.',
          hi: 'कम से कम एक रिकॉर्डिंग या अनुभाग जोड़ें।',
        }),
      );
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
        setNamePromptStatus(t({ en: 'Transcribing name…', hi: 'नाम लिखा जा रहा है…' }));
        name = await transcribeSpokenName(user.uid, sessionId, result.blob, result.duration);
      }
      await applyPhotoStoryName(sessionId, session, name);
      setShowNamePrompt(false);
      await doFinish();
    } catch (err) {
      setNamePromptStatus(
        err instanceof Error
          ? err.message
          : t({ en: 'Could not save name. Try typing.', hi: 'नाम सहेज नहीं सके।' }),
      );
    } finally {
      setFinishing(false);
    }
  };

  const handleChapterConfirm = async (chapterId: string) => {
    setAssigningChapter(true);
    try {
      await moveToChapter(chapterId);
      setShowChapterSheet(false);
      await finishNavigate();
    } finally {
      setAssigningChapter(false);
    }
  };

  const handleChapterSkip = () => {
    setShowChapterSheet(false);
    void finishNavigate();
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
    <div className="heritage-page pb-36">
      {activeBook && user && (
        <ChapterAssignSheet
          open={showChapterSheet}
          onClose={handleChapterSkip}
          onConfirm={handleChapterConfirm}
          activeBook={activeBook}
          chapters={chapters}
          suggestedChapterId={currentChapterId || session.chapterId}
          storyTitle={session.title}
          busy={assigningChapter || movingChapter}
          userId={user.uid}
          authorName={userDisplayName(user, profile)}
        />
      )}

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

      <div className="mb-5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-heritage-muted">
        <Link to={hubPath} className="hover:text-brand-600">
          {t({ en: 'Close', hi: 'बंद' })}
        </Link>
        {!session.isContributorStory && chapterLabel && (
          <span className="max-w-[50%] truncate text-center normal-case font-serif italic text-heritage-ink">
            {chapterLabel}
          </span>
        )}
        {session.isContributorStory && (
          <span className="max-w-[50%] truncate text-center normal-case text-xs text-brand-700">
            {t({ en: 'Contributing', hi: 'योगदान' })}
          </span>
        )}
        <Link to={hubPath} className="hover:text-brand-600">
          {t({ en: 'Save', hi: 'सहेजें' })}
        </Link>
      </div>

      {session.isContributorStory && (
        <div className="card mb-4 border-l-4 border-l-accent-400 py-3">
          <p className="text-xs text-heritage-muted">
            {t({ en: 'Contributing as', hi: 'योगदानकर्ता' })}{' '}
            <span className="font-semibold text-heritage-ink">{session.contributorName}</span>
            {session.contributorRelationship ? ` · ${session.contributorRelationship}` : ''}
          </p>
        </div>
      )}

      <label className="mb-2 block">
        <span className="heritage-label mb-1 block">
          {t({ en: 'Story title', hi: 'कहानी का नाम' })}
        </span>
        <input
          className={`heritage-title w-full border-0 border-b border-heritage-line bg-transparent px-0 py-1 focus:border-brand-500 focus:outline-none focus:ring-0 ${locale === 'hi' ? 'font-hindi' : ''}`}
          value={editStoryTitle}
          placeholder={t({ en: 'Name this story…', hi: 'कहानी का नाम…' })}
          onChange={(e) => setEditStoryTitle(e.target.value)}
          onBlur={() => void handleStoryTitleBlur()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      {status && (
        <span className="mb-4 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          <BilingualStatus en={status.en} hi={status.hi} />
        </span>
      )}

      {session.stimulusPrompt && !useBlockEditor && (
        <div className="card mb-4 border-l-4 border-l-brand-400">
          <p className={`text-sm leading-relaxed text-heritage-ink ${locale === 'hi' ? 'font-hindi' : ''}`}>
            {session.stimulusPrompt}
          </p>
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
          {session.clipOrder.length > 0 && (
            <p className="heritage-label mb-2">
              {t({ en: `Voice clips · ${session.clipOrder.length}`, hi: `आवाज़ · ${session.clipOrder.length}` })}
            </p>
          )}
          <ClipList
            clips={clips}
            clipOrder={session.clipOrder}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDelete={handleDelete}
            onLabelChange={(clipId, label) => void updateClipLabel(clipId, label)}
          />

          {!hasDraft && (
            <div className="my-8 flex flex-col items-center">
              <ClipRecorder autoSave hasExistingClip={session.clipOrder.length > 0} onClipReady={handleClipReady} />
            </div>
          )}

          {session.clipOrder.length > 0 && !hasDraft && (
            <div className="fixed bottom-20 left-0 right-0 z-30 mx-auto max-w-lg border-t border-heritage-line bg-heritage-cream/95 px-5 py-4 backdrop-blur-sm">
              <button type="button" className="btn-primary w-full" onClick={handleFinish} disabled={finishing}>
                <BilingualBtn
                  en={session.isContributorStory ? 'Submit story' : 'Finish & generate story'}
                  hi={session.isContributorStory ? 'कहानी जमा करें' : 'समाप्त करें और कहानी बनाएं'}
                />
              </button>
            </div>
          )}
        </>
      )}

      {hasDraft && session.draft && (
        <div className="card mt-4">
          <p className="heritage-label mb-2">{t({ en: 'Written note', hi: 'लिखित नोट' })}</p>
          <p className="whitespace-pre-wrap font-serif text-sm italic leading-relaxed text-heritage-ink">
            {session.editedDraft ?? session.draft}
          </p>
          <Link to={`/stories/${session.id}`} className="mt-3 block text-sm font-semibold text-brand-600">
            <T en="Edit draft →" hi="ड्राफ्ट संपादित करें →" />
          </Link>
        </div>
      )}

      {!hasDraft && !useBlockEditor && session.clipOrder.length === 0 && (
        <p className="text-center text-xs text-heritage-muted">
          <BilingualLine
            en="Tap the circle to record. Add multiple short clips in order."
            hi="रिकॉर्ड करने के लिए वृत्त दबाएं। क्रम में कई छोटी क्लिप जोड़ें।"
            enClass=""
            hiClass="text-heritage-muted"
          />
        </p>
      )}
    </div>
  );
}
