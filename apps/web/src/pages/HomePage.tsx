import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { BookPhotoImage } from '@/components/BookPhotoImage';
import { QuickStartRow } from '@/components/heritage/QuickStartRow';
import { promptText, promptTitle } from '@/data/stimuli';
import { canGoPreviousTurn, countHomeQueueItems, getNextHomeTurn } from '@/lib/homeTurnQueue';
import { useBookPhotos } from '@/hooks/useBookPhotos';
import { useBookPrompts } from '@/hooks/useBookPrompts';
import { createStoryInBook, storyBelongsToCollabBook } from '@/services/bookStructure';
import { previousBookTurn, skipBookPrompt } from '@/services/bookPrompts';
import { skipBookPhoto, startStoryFromBookPhoto } from '@/services/bookPhotos';
import { getOrCreateAlbumBookForCollab } from '@/services/books';
import { subscribeToSessions } from '@/services/storySessions';
import { userDisplayName } from '@/lib/userDisplayName';
import { resolveStoryBlocks, storyClipCount } from '@/lib/storyBlocks';
import type { StorySession } from '@/types';

function storyOpenHref(story: StorySession): string {
  const active = ['recording', 'transcribing', 'generating'].includes(story.status);
  return active ? `/story/${story.id}` : `/stories/${story.id}`;
}

function storyThumb(story: StorySession): string | null {
  const { order, blocks } = resolveStoryBlocks(story);
  for (const id of order) {
    const b = blocks[id];
    if (b?.type === 'image' && b.imageUrl) return b.imageUrl;
  }
  return story.imageStimulus?.imageUrl ?? null;
}

export function HomePage() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();
  const navigate = useNavigate();
  const t = usePickText();
  const { locale } = useUiLocale();
  const { prompts, completedIds, skippedTurnIds, bookId, userId } = useBookPrompts();
  const { photos, loading: photosLoading, bookId: photosBookId } = useBookPhotos();
  const [recent, setRecent] = useState<StorySession[]>([]);
  const [albumBookId, setAlbumBookId] = useState<string | null>(null);
  const [turnNavBusy, setTurnNavBusy] = useState(false);
  const [startingPhoto, setStartingPhoto] = useState(false);
  const [turnError, setTurnError] = useState('');

  const nextTurn = getNextHomeTurn(photos, prompts, completedIds, skippedTurnIds);
  const queueTotal = countHomeQueueItems(photos, prompts, completedIds);

  const name = profile?.displayName?.split(' ')[0] ?? t({ en: 'there', hi: 'मित्र' });

  useEffect(() => {
    if (!user || !activeBook) return;
    getOrCreateAlbumBookForCollab(user.uid, activeBook, userDisplayName(user, profile)).then((b) =>
      setAlbumBookId(b.id),
    );
  }, [user, profile, activeBook?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeToSessions(user.uid, (sessions) => {
      const filtered = activeBook
        ? sessions.filter((s) => storyBelongsToCollabBook(s, activeBook.id, albumBookId))
        : sessions;
      setRecent(
        [...filtered].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 3),
      );
    });
  }, [user, activeBook?.id, albumBookId]);

  const startPromptTurn = async (prompt = nextTurn?.type === 'prompt' ? nextTurn.prompt : null) => {
    if (!user || !prompt || !activeBook) return;
    const sessionId = await createStoryInBook(
      {
        userId: user.uid,
        bookId: activeBook.id,
        title: promptTitle(prompt, locale),
        sourceType: 'stimulus',
        stimulusId: prompt.id,
        stimulusPrompt: promptText(prompt, locale),
        languageHint: profile?.preferences.defaultLanguage ?? 'mixed',
        hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
        perspective: profile?.preferences.storyPerspective ?? 'first',
      },
      activeBook,
      userDisplayName(user, profile),
    );
    navigate(`/story/${sessionId}`);
  };

  const startPhotoTurn = async (photo = nextTurn?.type === 'photo' ? nextTurn.photo : null) => {
    if (!photo || !activeBook || !user || !photosBookId) return;

    if (photo.status === 'in_progress' && photo.storySessionId) {
      navigate(`/story/${photo.storySessionId}`, {
        state: { returnTo: '/', bookPhotoId: photo.id, bookId: photosBookId },
      });
      return;
    }

    setStartingPhoto(true);
    setTurnError('');
    try {
      const sessionId = await startStoryFromBookPhoto(
        photo,
        activeBook,
        userDisplayName(user, profile),
        {
          userId: user.uid,
          languageHint: profile?.preferences.defaultLanguage ?? 'mixed',
          hindiOutputMode: profile?.preferences.hindiOutputMode ?? 'hindi_script',
          perspective: profile?.preferences.storyPerspective ?? 'first',
        },
      );
      navigate(`/story/${sessionId}`, {
        state: { returnTo: '/', bookPhotoId: photo.id, bookId: photosBookId },
      });
    } catch (err) {
      console.error(err);
      setTurnError(t({ en: 'Could not start story.', hi: 'कहानी शुरू नहीं हो सकी।' }));
    } finally {
      setStartingPhoto(false);
    }
  };

  const skipCurrentTurn = async () => {
    if (!nextTurn || !bookId || !userId) return;

    setTurnNavBusy(true);
    try {
      if (nextTurn.type === 'photo') {
        await skipBookPhoto(bookId, userId, nextTurn.photo.id);
      } else {
        await skipBookPrompt(bookId, userId, nextTurn.prompt.id);
      }
    } finally {
      setTurnNavBusy(false);
    }
  };

  const previousTurn = async () => {
    if (!bookId || !userId || !canGoPreviousTurn(skippedTurnIds)) return;

    setTurnNavBusy(true);
    try {
      await previousBookTurn(bookId, userId);
      if (nextTurn?.type === 'photo' && nextTurn.photo.status === 'in_progress') {
        await skipBookPhoto(bookId, userId, nextTurn.photo.id);
      }
    } finally {
      setTurnNavBusy(false);
    }
  };

  const canSkip = Boolean(nextTurn);
  const canPrevious = Boolean(nextTurn) && canGoPreviousTurn(skippedTurnIds);

  const showTurnCard = !photosLoading && Boolean(nextTurn);

  return (
    <div className="heritage-page">
      <div className="mb-6">
        <h2 className={`font-serif text-2xl text-heritage-ink ${locale === 'hi' ? 'font-hindi' : ''}`}>
          {t({ en: `Hello, ${name}`, hi: `नमस्ते, ${name}` })}
        </h2>
      </div>

      {turnError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{turnError}</div>
      )}

      {showTurnCard && nextTurn && (
        <div className="card mb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="heritage-label text-brand-600">
              {nextTurn.type === 'photo'
                ? t({ en: 'Photo story', hi: 'फोटो कहानी' })
                : t({ en: 'Next prompt', hi: 'अगला प्रश्न' })}
            </span>
            <span className="text-xs font-medium text-heritage-muted">
              {t({
                en: `${queueTotal} in queue`,
                hi: `${queueTotal} कतार में`,
              })}
            </span>
          </div>

          <p
            className={`mb-3 min-h-[1rem] text-xs text-heritage-muted ${
              queueTotal > 1 ? '' : 'invisible'
            }`}
            aria-hidden={queueTotal <= 1}
          >
            {t({
              en: `${queueTotal} waiting — one at a time.`,
              hi: `${queueTotal} बाकी — एक-एक करके।`,
            })}
          </p>

          <p className="mb-3 text-sm font-medium text-heritage-ink">
            {nextTurn.type === 'photo' && nextTurn.photo.status === 'in_progress'
              ? t({ en: 'Continue this photo', hi: 'इस फोटो को जारी रखें' })
              : t({ en: 'Your turn', hi: 'आपकी बारी' })}
          </p>

          <div className="mb-4 flex h-[min(50dvh,280px)] min-h-[240px] items-center justify-center overflow-hidden rounded-xl bg-heritage-paper px-4 ring-1 ring-heritage-line">
            {nextTurn.type === 'photo' ? (
              <BookPhotoImage
                photo={nextTurn.photo}
                className="h-full max-h-full w-full object-contain"
              />
            ) : (
              <p
                className={`max-h-full overflow-y-auto text-center font-serif text-lg leading-snug text-heritage-ink ${locale === 'hi' ? 'font-hindi' : ''}`}
              >
                {promptText(nextTurn.prompt, locale)}
              </p>
            )}
          </div>

          <p
            className={`mb-3 min-h-4 text-center text-xs text-heritage-muted ${
              nextTurn.type === 'photo' && (nextTurn.photo.date || nextTurn.photo.year) ? '' : 'invisible'
            }`}
            aria-hidden={nextTurn.type !== 'photo' || !(nextTurn.photo.date || nextTurn.photo.year)}
          >
            {nextTurn.type === 'photo' ? (nextTurn.photo.date ?? nextTurn.photo.year) : '\u00a0'}
          </p>

          <div className="mb-4 min-h-[2.75rem]">
            {nextTurn.type === 'photo' ? (
              <BilingualLine
                en="Record your memories about this photo — same guided questions as when you add a photo story."
                hi="इस फोटो के बारे में अपनी यादें रिकॉर्ड करें — जैसे फोटो कहानी जोड़ते समय।"
                enClass="text-sm text-heritage-muted"
                hiClass="text-sm text-heritage-muted"
              />
            ) : (
              <BilingualLine
                en="Record your answer — same guided flow as your other memories."
                hi="अपना जवाब रिकॉर्ड करें — बाकी यादों जैसा ही सरल प्रवाह।"
                enClass="text-sm text-heritage-muted"
                hiClass="text-sm text-heritage-muted"
              />
            )}
          </div>

          {nextTurn.type === 'photo' ? (
            <button
              type="button"
              className="btn-primary w-full"
              disabled={startingPhoto}
              onClick={() => void startPhotoTurn()}
            >
              {startingPhoto ? (
                <BilingualBtn en="Opening…" hi="खुल रहा…" />
              ) : nextTurn.photo.status === 'in_progress' ? (
                <BilingualBtn en="Continue story" hi="कहानी जारी रखें" />
              ) : (
                <BilingualBtn en="Tell this story" hi="यह कहानी सुनाएं" />
              )}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void startPromptTurn()}
            >
              <BilingualBtn en="Record memory" hi="याद रिकॉर्ड करें" />
            </button>
          )}

          {(canPrevious || canSkip) && (
            <div
              className={`mt-2 flex items-center gap-3 ${
                canPrevious && canSkip ? 'justify-between' : 'justify-center'
              }`}
            >
              {canPrevious && (
                <button
                  type="button"
                  className="text-xs text-heritage-muted underline"
                  disabled={turnNavBusy}
                  onClick={() => void previousTurn()}
                >
                  <T en="Previous" hi="पिछला" />
                </button>
              )}
              {canSkip && (
                <button
                  type="button"
                  className="text-xs text-heritage-muted underline"
                  disabled={turnNavBusy}
                  onClick={() => void skipCurrentTurn()}
                >
                  <T en="Skip for now" hi="अभी छोड़ें" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-8">
        <QuickStartRow />
      </div>

      {recent.length > 0 && (
        <div>
          <p className="heritage-label mb-3">{t({ en: 'Recent', hi: 'हाल की' })}</p>
          <div className="space-y-2">
            {recent.map((story) => {
              const thumb = storyThumb(story);
              const clipCount = storyClipCount(story);
              const photoCount = resolveStoryBlocks(story).order.filter(
                (id) => resolveStoryBlocks(story).blocks[id]?.type === 'image',
              ).length;
              return (
                <Link
                  key={story.id}
                  to={storyOpenHref(story)}
                  className="card flex items-center gap-3 py-3 transition active:scale-[0.99]"
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-heritage-line text-lg">
                      📖
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-heritage-ink">{story.title}</p>
                    <p className="text-xs text-heritage-muted">
                      {clipCount} {t({ en: clipCount === 1 ? 'clip' : 'clips', hi: 'क्लिप' })}
                      {photoCount > 0 && ` · ${photoCount} ${t({ en: 'photo', hi: 'फोटो' })}`}
                      {' · '}
                      {story.updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-heritage-muted">→</span>
                </Link>
              );
            })}
          </div>
          <Link to="/stories" className="btn-ghost mt-3 block text-center">
            <T en="View all stories →" hi="सभी कहानियाँ →" />
          </Link>
        </div>
      )}

      {!activeBook && (
        <div className="card mt-6 text-center">
          <p className="text-sm text-heritage-muted">
            <T en="Choose a book to start recording memories." hi="यादें रिकॉर्ड करने के लिए पुस्तक चुनें।" />
          </p>
          <Link to="/books" className="btn-primary mt-4 inline-block">
            <BilingualBtn en="Choose book" hi="पुस्तक चुनें" />
          </Link>
        </div>
      )}
    </div>
  );
}
