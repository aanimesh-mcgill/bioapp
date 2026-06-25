import { useEffect, useState } from 'react';

import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import {

  subscribeToSession,

  subscribeToClips,

  updateSessionDraft,

  approveSession,

  rejectSession,

} from '@/services/storySessions';

import {

  updateEditedTranscript,

  uploadStoryAttachment,

  addLinkAttachment,

  removeAttachment,

} from '@/services/books';

import { ImageStimulusPromptsEditor } from '@/components/ImageStimulusPromptsEditor';

import { SectionHeading, BilingualBtn, BilingualLine, T } from '@/components/BilingualText';

import { usePickText } from '@/context/UiLocaleContext';

import { SpreadClipPlayer } from '@/components/SpreadClipPlayer';

import { StoryContentView } from '@/components/StoryContentView';

import { resolveStoryBlocks, imageBlockAsStimulus, storyClipIds } from '@/lib/storyBlocks';
import { isContributorStorySubmitted } from '@/lib/contributorStories';
import type { StorySession, AudioClip } from '@/types';



export function StoryDetailPage() {

  const { sessionId } = useParams<{ sessionId: string }>();

  const { user, profile } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const contributeBack = (location.state as { fromContributeHub?: string } | null)?.fromContributeHub;
  const canHistoryBack = location.key !== 'default';

  const t = usePickText();

  const [session, setSession] = useState<StorySession | null>(null);

  const [clips, setClips] = useState<AudioClip[]>([]);

  const [draft, setDraft] = useState('');

  const [transcript, setTranscript] = useState('');

  const [saving, setSaving] = useState(false);

  const [buyerNotes, setBuyerNotes] = useState('');

  const [actionMsg, setActionMsg] = useState('');

  const [linkUrl, setLinkUrl] = useState('');

  const [linkTitle, setLinkTitle] = useState('');

  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [mediaUploading, setMediaUploading] = useState(false);



  useEffect(() => {

    if (!sessionId) return;

    return subscribeToSession(sessionId, (s) => {

      setSession(s);

      if (s) {

        setDraft(s.editedDraft ?? s.draft ?? '');

        setTranscript(s.editedTranscript ?? s.combinedTranscript?.text ?? '');

      }

    });

  }, [sessionId]);


  useEffect(() => {

    if (!sessionId) return;

    return subscribeToClips(sessionId, setClips);

  }, [sessionId]);


  if (!session) {

    return (

      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">

        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />

      </div>

    );

  }



  const isHindi = session.outputLanguage === 'hi';

  const isBuyer = profile?.role === 'buyer' || profile?.role === 'admin';
  const isStoryOwner = user?.uid === session.userId;
  const isBookOwner = user?.uid === session.bookOwnerId;
  const contributorViewOnly =
    !!session.isContributorStory &&
    isContributorStorySubmitted(session) &&
    isStoryOwner &&
    !isBookOwner;
  const canApproveStory =
    session.status === 'pending_approval' &&
    !contributorViewOnly &&
    (isBuyer || isBookOwner || (isStoryOwner && !session.isContributorStory));

  const { order, blocks } = resolveStoryBlocks(session);
  const hasContentBlocks = order.length > 0;
  const imageBlock = order.map((id) => blocks[id]).find((b) => b?.type === 'image');
  const photoStimulus =
    !hasContentBlocks &&
    (session.imageStimulus ??
      (imageBlock?.type === 'image' ? imageBlockAsStimulus(imageBlock) : null));

  const orderedClips = storyClipIds(session)
    .map((id) => clips.find((c) => c.id === id && c.errorMessage !== 'removed'))
    .filter(Boolean) as AudioClip[];

  const playableClips = orderedClips.filter((c) => c.audioUrl);

  const pendingClips = orderedClips.filter((c) => !c.audioUrl);



  const handleSaveDraft = async () => {

    if (!sessionId) return;

    setSaving(true);

    try {

      await updateSessionDraft(sessionId, draft);

      setActionMsg(t({ en: 'Draft saved.', hi: 'ड्राफ्ट सहेजा गया।' }));

    } finally {

      setSaving(false);

    }

  };



  const handleSaveTranscript = async () => {

    if (!sessionId) return;

    setSaving(true);

    try {

      await updateEditedTranscript(sessionId, transcript);

      setActionMsg(t({ en: 'Transcript saved.', hi: 'प्रतिलेख सहेजा गया।' }));

    } finally {

      setSaving(false);

    }

  };



  const handleAddLink = async () => {

    if (!sessionId || !linkUrl.trim()) return;

    await addLinkAttachment(sessionId, linkUrl.trim(), linkTitle.trim() || linkUrl);

    setLinkUrl('');

    setLinkTitle('');

    setActionMsg(t({ en: 'Link added.', hi: 'लिंक जोड़ा गया।' }));

  };



  const handleUploadMedia = async () => {

    if (!sessionId || !user || !mediaFile) return;

    setMediaUploading(true);

    try {

      await uploadStoryAttachment(user.uid, sessionId, mediaFile);

      setMediaFile(null);

      setActionMsg(t({ en: 'Media saved.', hi: 'मीडिया सहेजा गया।' }));

    } catch {

      setActionMsg(t({ en: 'Upload failed. Try again.', hi: 'अपलोड विफल। फिर कोशिश करें।' }));

    } finally {

      setMediaUploading(false);

    }

  };



  const handleApprove = async () => {

    if (!sessionId) return;

    await approveSession(sessionId, buyerNotes);

    setActionMsg(t({ en: 'Story approved!', hi: 'कहानी स्वीकृत!' }));

  };



  const handleReject = async () => {

    if (!sessionId || !buyerNotes.trim()) return;

    await rejectSession(sessionId, buyerNotes);

    setActionMsg(t({ en: 'Sent back for revision.', hi: 'संशोधन के लिए भेजा गया।' }));

  };



  return (

    <div className="px-4 py-6">

      {contributeBack ? (
        <Link to={contributeBack} className="mb-4 inline-block text-sm text-brand-600">
          ← {t({ en: 'Back to contributions', hi: 'योगदान पर वापस' })}
        </Link>
      ) : canHistoryBack ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-block text-sm text-brand-600"
        >
          ← {t({ en: 'Back', hi: 'वापस' })}
        </button>
      ) : null}



      <div className="mb-4 flex items-start justify-between gap-2">

        <h1 className="text-xl font-bold text-brand-600">{session.title}</h1>

        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">

          {session.status.replace('_', ' ')}

        </span>

      </div>



      {contributorViewOnly && (
        <div className="card mb-4 border-l-4 border-l-green-500 py-3">
          <p className="text-sm text-heritage-ink">
            {t({
              en: 'Submitted to the book owner. You can view your copy here but cannot edit it.',
              hi: 'पुस्तक स्वामी को जमा कर दी गई। आप यहाँ प्रति देख सकते हैं, संपादित नहीं कर सकते।',
            })}
          </p>
        </div>
      )}

      {session.contributorName && (

        <div className="card mb-4 border-l-4 border-l-accent-400">

          <BilingualLine en="Contributed by" hi="योगदानकर्ता" enClass="text-xs text-slate-500" hiClass="text-xs text-slate-400" />

          <p className="font-semibold text-brand-800">{session.contributorName}</p>

          <p className="text-sm text-brand-600">{session.contributorRelationship}</p>

        </div>

      )}



      {hasContentBlocks && <StoryContentView session={session} clips={clips} />}

      {hasContentBlocks && !contributorViewOnly && session.status !== 'approved' && (
        <Link to={`/story/${session.id}`} className="mb-4 inline-block text-sm text-brand-600">
          {t({ en: 'Edit story content →', hi: 'कहानी संपादित करें →' })}
        </Link>
      )}

      {photoStimulus && user && !contributorViewOnly && (
        <section className="mb-4">
          <img
            src={photoStimulus.imageUrl}
            alt={photoStimulus.title}
            className="mb-2 max-h-[70vh] w-full rounded-xl object-contain"
          />
          <p className="text-sm font-medium">{photoStimulus.title}</p>
          <SectionHeading en="Photo prompts" hi="फोटो प्रश्न" />
          <ImageStimulusPromptsEditor
            sessionId={session.id}
            userId={user.uid}
            showImagePreview={false}
            onSaved={() => setActionMsg(t({ en: 'Photo answers saved.', hi: 'फोटो उत्तर सहेजे गए।' }))}
          />
        </section>
      )}



      {!hasContentBlocks && orderedClips.length > 0 && (

        <section className="card mb-4">

          <SectionHeading en="Voice recordings" hi="आवाज़ रिकॉर्डिंग" />

          {playableClips.length > 0 ? (

            <SpreadClipPlayer clips={orderedClips} />

          ) : (

            <p className="text-sm text-amber-700">

              {t({

                en: `${pendingClips.length} recording(s) could not be played — upload may still be in progress or failed.`,

                hi: `${pendingClips.length} रिकॉर्डिंग चल नहीं सकी — अपलोड अधूरा या विफल हो सकता है।`,

              })}

            </p>

          )}

          {pendingClips.length > 0 && playableClips.length > 0 && (

            <p className="mt-2 text-xs text-slate-500">

              {t({

                en: `${pendingClips.length} clip(s) still processing.`,

                hi: `${pendingClips.length} क्लिप अभी प्रोसेस हो रही है।`,

              })}

            </p>

          )}

          {session.status !== 'approved' && !contributorViewOnly && (

            <Link to={`/story/${session.id}`} className="mt-3 inline-block text-sm text-brand-600">

              {t({ en: 'Re-record in story editor →', hi: 'कहानी संपादक में फिर रिकॉर्ड करें →' })}

            </Link>

          )}

        </section>

      )}



      {!contributorViewOnly && (
      <>
      <section className="card mb-4">

        <SectionHeading en="Transcript (editable)" hi="प्रतिलेख (संपादन योग्य)" />

        <textarea

          className={`input-field min-h-[120px] resize-y ${isHindi ? 'font-hindi' : ''}`}

          value={transcript}

          onChange={(e) => setTranscript(e.target.value)}

        />

        <button className="btn-primary mt-2 w-full" onClick={handleSaveTranscript} disabled={saving}>

          <BilingualBtn en="Save Transcript" hi="प्रतिलेख सहेजें" />

        </button>

      </section>



      <section className="card mb-4">

        <SectionHeading en="Story Draft" hi="कहानी ड्राफ्ट" />

        <textarea

          className={`input-field min-h-[200px] resize-y ${isHindi ? 'font-hindi' : ''}`}

          value={draft}

          onChange={(e) => setDraft(e.target.value)}

          disabled={session.status === 'approved'}

        />

        {session.status !== 'approved' && (

          <button className="btn-primary mt-3 w-full" onClick={handleSaveDraft} disabled={saving}>

            {saving ? (

              <BilingualBtn en="Saving…" hi="सहेज रहे हैं…" />

            ) : (

              <BilingualBtn en="Save Draft" hi="ड्राफ्ट सहेजें" />

            )}

          </button>

        )}

      </section>



      <section className="card mb-4">

        <SectionHeading en="Media & Links" hi="मीडिया और लिंक" />

        {session.attachments?.map((att) => (

          <div key={att.id} className="mb-3 flex items-start gap-2 border-b border-slate-100 pb-3">

            <div className="min-w-0 flex-1">

              {att.type === 'image' && <img src={att.url} alt="" className="max-h-24 rounded-lg" />}

              {att.type === 'link' && (

                <a href={att.url} className="text-sm text-brand-600 underline" target="_blank" rel="noopener noreferrer">

                  {att.title ?? att.url}

                </a>

              )}

              {att.type === 'video' && <video src={att.url} controls className="max-h-32 w-full" />}

            </div>

            <button type="button" className="text-xs text-red-500" onClick={() => sessionId && removeAttachment(sessionId, att.id)}>

              <T en="Remove" hi="हटाएं" />

            </button>

          </div>

        ))}

        <BilingualLine

          en="Add image or video"

          hi="फोटो या वीडियो जोड़ें"

          enClass="mb-2 block text-xs font-medium text-slate-600"

          hiClass="mb-2 block text-xs text-slate-500"

        />

        <input

          type="file"

          accept="image/*,video/*"

          className="input-field mb-3"

          onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}

        />

        {mediaFile && (

          <p className="mb-2 text-xs text-slate-600">{mediaFile.name}</p>

        )}

        <button

          type="button"

          className="btn-primary mb-3 w-full"

          onClick={handleUploadMedia}

          disabled={!mediaFile || mediaUploading}

        >

          {mediaUploading ? (

            <BilingualBtn en="Uploading…" hi="अपलोड हो रहा…" />

          ) : (

            <BilingualBtn en="Save media" hi="मीडिया सहेजें" />

          )}

        </button>

        <div className="flex gap-2">

          <input className="input-field flex-1" placeholder={t({ en: 'Link URL', hi: 'लिंक URL' })} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />

          <input className="input-field flex-1" placeholder={t({ en: 'Title', hi: 'शीर्षक' })} value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />

        </div>

        <button type="button" className="btn-secondary mt-2 w-full" onClick={handleAddLink}>

          <BilingualBtn en="Add Link" hi="लिंक जोड़ें" />

        </button>

      </section>
      </>
      )}



      {canApproveStory && (

        <section className="card">

          <SectionHeading en="Approve story" hi="कहानी स्वीकृत करें" />

          <p className="mb-3 text-sm text-slate-600">
            {session.isContributorStory
              ? 'Review this contributor story, then approve it for your book.'
              : 'Your draft is ready. Approve it to mark it complete and include it in your book.'}
          </p>

          <textarea

            className="input-field mb-3 min-h-[80px]"

            placeholder={t({ en: 'Optional notes', hi: 'वैकल्पिक नोट' })}

            value={buyerNotes}

            onChange={(e) => setBuyerNotes(e.target.value)}

          />

          <div className="flex gap-3">

            <button className="btn-primary flex-1" onClick={handleApprove}>

              <BilingualBtn en="Approve" hi="स्वीकृत" />

            </button>

            <button className="btn-secondary flex-1 border-red-600 text-red-600" onClick={handleReject} disabled={!buyerNotes.trim()}>

              <BilingualBtn en="Request Changes" hi="बदलाव माँगें" />

            </button>

          </div>

        </section>

      )}



      {actionMsg && <p className="mt-4 text-center text-sm text-green-600">{actionMsg}</p>}

    </div>

  );

}


