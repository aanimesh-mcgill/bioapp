import { useState } from 'react';

import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import { useContributorInvite } from '@/context/ContributorContext';

import { createStorySession } from '@/services/storySessions';
import { addImageBlock, addTextBlock } from '@/services/storyBlocks';
import { contributorSessionBase, contributorStoryTitle } from '@/lib/contributorSession';
import { PHOTO_STORY_PLACEHOLDER } from '@/lib/photoStory';

import { ImageMetadataForm, TextStimulusForm } from '@/components/StimulusForms';

import { PageHeading, BilingualBtn } from '@/components/BilingualText';
import { usePickText } from '@/context/UiLocaleContext';



export function ContributeRecordPage() {

  const t = usePickText();
  const { invite } = useContributorInvite();

  const { user } = useAuth();

  const navigate = useNavigate();

  const [title, setTitle] = useState('');

  const [submitting, setSubmitting] = useState(false);



  if (!invite || !user) return <Navigate to={`/contribute/${invite?.inviteSlug ?? ''}`} replace />;



  const handleStart = async () => {

    if (!title.trim()) return;

    setSubmitting(true);

    try {

      const sessionId = await createStorySession({

        ...contributorSessionBase(user.uid, invite),

        title: contributorStoryTitle(invite, title.trim()),

        sourceType: 'freeform',

      });

      navigate(`/contribute/${invite.inviteSlug}/story/${sessionId}`);

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <div className="px-4 py-6">

      <Link to={`/contribute/${invite.inviteSlug}/hub`} className="mb-4 inline-block text-sm text-brand-600">

        ← {t({ en: 'Back', hi: 'वापस' })}

      </Link>

      <PageHeading en="Record a story" hi="कहानी रिकॉर्ड करें" className="mb-2" />

      <p className="mb-4 text-sm text-slate-500">

        {t({
          en: `As ${invite.contributorName} (${invite.relationship})`,
          hi: `${invite.contributorName} के रूप में (${invite.relationship})`,
        })}

      </p>

      <input

        className="input-field mb-4"

        placeholder={t({ en: 'What is this memory about?', hi: 'यह याद किस बारे में है?' })}

        value={title}

        onChange={(e) => setTitle(e.target.value)}

      />

      <button type="button" className="btn-primary w-full" onClick={handleStart} disabled={submitting || !title.trim()}>

        {submitting ? (

          <BilingualBtn en="Starting…" hi="शुरू हो रहा…" />

        ) : (

          <BilingualBtn en="Start Recording" hi="रिकॉर्डिंग शुरू" />

        )}

      </button>

    </div>

  );

}



export function ContributeAddPhotoPage() {

  const t = usePickText();
  const { invite } = useContributorInvite();

  const { user } = useAuth();

  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);



  if (!invite || !user) return <Navigate to={`/contribute/${invite?.inviteSlug ?? ''}`} replace />;



  const handleContinue = async (data: {

    file: File;

    date?: string;

    year?: number;

  }) => {

    setSubmitting(true);

    try {

      const id = await createStorySession({

        ...contributorSessionBase(user.uid, invite),

        title: contributorStoryTitle(invite, PHOTO_STORY_PLACEHOLDER),

        sourceType: 'image_stimulus',

      });

      await addImageBlock(user.uid, id, { ...data, title: '' });

      navigate(`/contribute/${invite.inviteSlug}/story/${id}`);

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <div className="px-4 py-6">

      <Link to={`/contribute/${invite.inviteSlug}/hub`} className="mb-4 inline-block text-sm text-brand-600">

        ← {t({ en: 'Back', hi: 'वापस' })}

      </Link>

      <PageHeading en="Photo + story" hi="फोटो + कहानी" className="mb-4" />

      <ImageMetadataForm onContinue={handleContinue} submitting={submitting} />

    </div>

  );

}



export function ContributeAddTextPage() {

  const t = usePickText();
  const { invite } = useContributorInvite();

  const { user } = useAuth();

  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);



  if (!invite || !user) return <Navigate to={`/contribute/${invite?.inviteSlug ?? ''}`} replace />;



  const handleSubmit = async (data: { content: string; date?: string; year?: number }) => {

    setSubmitting(true);

    try {

      const sessionId = await createStorySession({

        ...contributorSessionBase(user.uid, invite),

        title: contributorStoryTitle(invite, data.content.slice(0, 40)),

        sourceType: 'text_stimulus',

      });

      await addTextBlock(sessionId, data);

      navigate(`/contribute/${invite.inviteSlug}/story/${sessionId}`);

    } finally {

      setSubmitting(false);

    }

  };



  return (

    <div className="px-4 py-6">

      <Link to={`/contribute/${invite.inviteSlug}/hub`} className="mb-4 inline-block text-sm text-brand-600">

        ← {t({ en: 'Back', hi: 'वापस' })}

      </Link>

      <PageHeading en="Text note + story" hi="टेक्स्ट नोट + कहानी" className="mb-4" />

      <TextStimulusForm onSubmit={handleSubmit} submitting={submitting} />

    </div>

  );

}


