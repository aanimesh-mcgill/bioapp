import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageHeading, BilingualLine, BilingualBtn, BilingualStatus } from '@/components/BilingualText';
import { SESSION_STATUS } from '@/lib/bilingualUi';
import { subscribeToSessions } from '@/services/storySessions';
import type { StorySession } from '@/types';

const statusColors: Record<StorySession['status'], string> = {
  recording: 'bg-blue-100 text-blue-700',
  transcribing: 'bg-amber-100 text-amber-700',
  generating: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  pending_approval: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
};

const sourceIcons: Record<string, string> = {
  freeform: '🎙️',
  stimulus: '✨',
  text_stimulus: '📝',
  image_stimulus: '📷',
};

export function StoriesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('session');
  const [sessions, setSessions] = useState<StorySession[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToSessions(user.uid, setSessions);
  }, [user]);

  if (sessions.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 text-5xl">📖</span>
        <PageHeading en="No stories yet" hi="अभी कोई कहानी नहीं" />
        <BilingualLine
          en="Start a life story prompt or record freely."
          hi="जीवन कथा प्रश्न से शुरू करें या मुक्त रिकॉर्ड करें।"
          enClass="mt-2 text-slate-600"
          hiClass="text-sm text-slate-500"
        />
        <Link to="/prompts" className="btn-primary mt-6">
          <BilingualBtn en="Browse Prompts" hi="प्रश्न देखें" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <PageHeading en="My Stories" hi="मेरी कहानियाँ" />
        <Link to="/record" className="text-sm font-semibold text-brand-600">
          + New / + नई
        </Link>
      </div>

      <BilingualLine
        en="Transcription runs in the background — you can keep recording other stories."
        hi="प्रतिलेखन पृष्ठभूमि में चलता है — आप अन्य कहानियाँ रिकॉर्ड कर सकते हैं।"
        enClass="mb-4 text-xs text-slate-500"
        hiClass="mb-4 text-xs text-slate-400"
      />

      <div className="space-y-3">
        {sessions.map((s) => {
          const isHighlighted = s.id === highlightId;
          const canEdit = ['ready', 'pending_approval', 'approved', 'rejected'].includes(s.status);
          const isActive = ['recording', 'transcribing', 'generating'].includes(s.status);
          const status = SESSION_STATUS[s.status];

          return (
            <div key={s.id} className={`card ${isHighlighted ? 'ring-2 ring-brand-400' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span>{sourceIcons[s.sourceType] ?? '📖'}</span>
                    <h3 className="truncate font-semibold text-slate-900">{s.title}</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.updatedAt.toLocaleDateString()} · {s.clipOrder.length} clip
                    {s.clipOrder.length !== 1 ? 's' : ''} / क्लिप
                  </p>
                </div>
                {status && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[s.status]}`}
                  >
                    <BilingualStatus en={status.en} hi={status.hi} />
                  </span>
                )}
              </div>

              {s.imageStimulus?.imageUrl && (
                <img
                  src={s.imageStimulus.imageUrl}
                  alt=""
                  className="mt-2 h-16 w-16 rounded-lg object-cover"
                />
              )}

              {s.status === 'error' && s.errorMessage && (
                <p className="mt-2 text-xs text-red-600">{s.errorMessage}</p>
              )}

              {isActive && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  <BilingualLine
                    en="Processing in background…"
                    hi="पृष्ठभूमि में प्रसंस्करण…"
                    enClass=""
                    hiClass="text-slate-400"
                  />
                </div>
              )}

              <div className="mt-3 flex gap-4">
                {isActive && (
                  <Link to={`/story/${s.id}`} className="text-sm font-semibold text-brand-600">
                    Continue recording → / रिकॉर्ड जारी →
                  </Link>
                )}
                {canEdit && (
                  <Link to={`/stories/${s.id}`} className="text-sm font-semibold text-brand-600">
                    View draft → / ड्राफ्ट देखें →
                  </Link>
                )}
                {s.status === 'recording' && (
                  <Link to={`/story/${s.id}`} className="text-sm font-semibold text-brand-600">
                    Add clips → / क्लिप जोड़ें →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
