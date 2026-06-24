import { useEffect, useState } from 'react';

import { useParams, Link } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import {

  subscribeToSession,

  updateSessionDraft,

  approveSession,

  rejectSession,

} from '@/services/storySessions';

import {

  updateEditedTranscript,

  uploadStoryAttachment,

  addLinkAttachment,

  removeAttachment,

  getOrCreateBook,

} from '@/services/books';

import { ImageStimulusPromptsEditor } from '@/components/ImageStimulusPromptsEditor';

import { SectionHeading, BilingualBtn, BilingualLine } from '@/components/BilingualText';

import { QrCodeDisplay } from '@/components/QrCodeDisplay';

import { storyPublicUrl } from '@/lib/slug';

import { userDisplayName } from '@/lib/userDisplayName';

import { resolveStoryBlocks, imageBlockAsStimulus } from '@/lib/storyBlocks';
import type { StorySession } from '@/types';



export function StoryDetailPage() {

  const { sessionId } = useParams<{ sessionId: string }>();

  const { user, profile } = useAuth();

  const [session, setSession] = useState<StorySession | null>(null);

  const [draft, setDraft] = useState('');

  const [transcript, setTranscript] = useState('');

  const [saving, setSaving] = useState(false);

  const [buyerNotes, setBuyerNotes] = useState('');

  const [actionMsg, setActionMsg] = useState('');

  const [bookSlug, setBookSlug] = useState('');

  const [linkUrl, setLinkUrl] = useState('');

  const [linkTitle, setLinkTitle] = useState('');



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

    if (!user) return;

    getOrCreateBook(user.uid, userDisplayName(user, profile)).then((b) => setBookSlug(b.publicSlug));

  }, [user, profile]);



  if (!session) {

    return (

      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">

        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />

      </div>

    );

  }



  const isHindi = session.outputLanguage === 'hi';

  const isBuyer = profile?.role === 'buyer' || profile?.role === 'admin';

  const storyQrUrl =
    session.publicSlug && bookSlug
      ? storyPublicUrl(bookSlug, session.publicSlug)
      : null;

  const { order, blocks } = resolveStoryBlocks(session);
  const imageBlock = order.map((id) => blocks[id]).find((b) => b?.type === 'image');
  const photoStimulus =
    session.imageStimulus ??
    (imageBlock?.type === 'image' ? imageBlockAsStimulus(imageBlock) : null);



  const handleSaveDraft = async () => {

    if (!sessionId) return;

    setSaving(true);

    try {

      await updateSessionDraft(sessionId, draft);

      setActionMsg('Draft saved. / ड्राफ्ट सहेजा गया।');

    } finally {

      setSaving(false);

    }

  };



  const handleSaveTranscript = async () => {

    if (!sessionId) return;

    setSaving(true);

    try {

      await updateEditedTranscript(sessionId, transcript);

      setActionMsg('Transcript saved. / प्रतिलेख सहेजा गया।');

    } finally {

      setSaving(false);

    }

  };



  const handleAddLink = async () => {

    if (!sessionId || !linkUrl.trim()) return;

    await addLinkAttachment(sessionId, linkUrl.trim(), linkTitle.trim() || linkUrl);

    setLinkUrl('');

    setLinkTitle('');

    setActionMsg('Link added. / लिंक जोड़ा गया।');

  };



  const handleApprove = async () => {

    if (!sessionId) return;

    await approveSession(sessionId, buyerNotes);

    setActionMsg('Story approved! / कहानी स्वीकृत!');

  };



  const handleReject = async () => {

    if (!sessionId || !buyerNotes.trim()) return;

    await rejectSession(sessionId, buyerNotes);

    setActionMsg('Sent back for revision. / संशोधन के लिए भेजा गया।');

  };



  return (

    <div className="px-4 py-6">

      <Link to="/stories" className="mb-4 inline-block text-sm text-brand-600">

        ← Back to stories / कहानियों पर वापस

      </Link>



      <div className="mb-4 flex items-start justify-between gap-2">

        <h1 className="text-xl font-bold text-brand-600">{session.title}</h1>

        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">

          {session.status.replace('_', ' ')}

        </span>

      </div>



      {session.contributorName && (

        <div className="card mb-4 border-l-4 border-l-accent-400">

          <BilingualLine en="Contributed by" hi="योगदानकर्ता" enClass="text-xs text-slate-500" hiClass="text-xs text-slate-400" />

          <p className="font-semibold text-brand-800">{session.contributorName}</p>

          <p className="text-sm text-brand-600">{session.contributorRelationship}</p>

        </div>

      )}



      {storyQrUrl && (

        <div className="card mb-4 flex flex-col items-center">

          <QrCodeDisplay

            url={storyQrUrl}

            label="QR — scan to read & hear this story / QR — कहानी पढ़ने और सुनने के लिए स्कैन करें"

            size={140}

          />

          <BilingualLine

            en="Place this QR on the photo or stimulus — opens the story with audio"

            hi="इस QR को फोटो या उद्दीपक पर लगाएं — ऑडियो के साथ कहानी खुलेगी"

            enClass="mt-2 text-center text-xs text-slate-500"

            hiClass="text-center text-xs text-slate-400"

          />

        </div>

      )}



      {photoStimulus && user && (
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
            onSaved={() => setActionMsg('Photo answers saved. / फोटो उत्तर सहेजे गए।')}
          />
        </section>
      )}



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

              Remove / हटाएं

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

          onChange={async (e) => {

            const file = e.target.files?.[0];

            if (file && sessionId && user) {

              await uploadStoryAttachment(user.uid, sessionId, file);

              setActionMsg('Media added. / मीडिया जोड़ा गया।');

            }

          }}

        />

        <div className="flex gap-2">

          <input className="input-field flex-1" placeholder="Link URL / लिंक URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />

          <input className="input-field flex-1" placeholder="Title / शीर्षक" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />

        </div>

        <button type="button" className="btn-secondary mt-2 w-full" onClick={handleAddLink}>

          <BilingualBtn en="Add Link" hi="लिंक जोड़ें" />

        </button>

      </section>



      {isBuyer && session.status === 'pending_approval' && (

        <section className="card">

          <SectionHeading en="Buyer Review" hi="खरीदार समीक्षा" />

          <textarea

            className="input-field mb-3 min-h-[80px]"

            placeholder="Notes (required for rejection) / नोट (अस्वीकृति के लिए आवश्यक)"

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


