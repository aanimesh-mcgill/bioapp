import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicBookByToken } from '@/services/books';
import type { PublicBookSnapshot } from '@/types';

type PlaybackSegment =
  | { id: string; kind: 'tts'; label: string; text: string }
  | { id: string; kind: 'audio'; label: string; audioUrl: string };

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function getImageName(url?: string) {
  if (!url) return '';
  try {
    const full = new URL(url);
    const fileName = full.pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(fileName).replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-_]+/g, ' ');
  } catch {
    return '';
  }
}

function buildAudiobookSegments(book: PublicBookSnapshot): PlaybackSegment[] {
  const segments: PlaybackSegment[] = [];
  const clips = [...book.audioClips].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const remainingClipIds = new Set(clips.map((clip) => clip.id));

  const findMatchingClip = (storyTitle: string) => {
    const storyKey = normalize(storyTitle);
    return clips.find((clip) => {
      if (!remainingClipIds.has(clip.id)) return false;
      const clipKey = normalize(clip.promptText);
      return clipKey === storyKey || clipKey.includes(storyKey) || storyKey.includes(clipKey);
    });
  };

  segments.push({
    id: 'intro',
    kind: 'tts',
    label: `Intro: ${book.bookTitle}`,
    text: `Now reading ${book.bookTitle}.`,
  });

  book.stories.forEach((story, index) => {
    segments.push({
      id: `story-title-${story.id}`,
      kind: 'tts',
      label: `Chapter ${index + 1}: ${story.title}`,
      text: `Chapter ${index + 1}. ${story.title}.`,
    });

    const imageName = getImageName(story.imageUrl);
    if (imageName) {
      segments.push({
        id: `story-image-${story.id}`,
        kind: 'tts',
        label: `Image: ${imageName}`,
        text: `Image name: ${imageName}.`,
      });
    }

    const matchedClip = findMatchingClip(story.title);
    if (matchedClip?.audioUrl) {
      remainingClipIds.delete(matchedClip.id);
      segments.push({
        id: `story-audio-${matchedClip.id}`,
        kind: 'audio',
        label: `Audio for ${story.title}`,
        audioUrl: matchedClip.audioUrl,
      });
    } else {
      segments.push({
        id: `story-content-${story.id}`,
        kind: 'tts',
        label: `Story text: ${story.title}`,
        text: `Story by ${story.authorName}. ${story.content}`,
      });
    }
  });

  const extraClips = clips.filter((clip) => remainingClipIds.has(clip.id));
  if (extraClips.length > 0) {
    segments.push({
      id: 'extra-prompts',
      kind: 'tts',
      label: 'Additional prompts',
      text: 'Now playing additional prompts and image notes.',
    });
  }

  extraClips.forEach((clip) => {
    const imageName = getImageName(clip.imageUrl);
    const labelText = clip.promptText || imageName || 'Untitled prompt';

    segments.push({
      id: `prompt-label-${clip.id}`,
      kind: 'tts',
      label: `Prompt: ${labelText}`,
      text: imageName
        ? `${clip.promptType} prompt: ${clip.promptText}. Image name: ${imageName}.`
        : `${clip.promptType} prompt: ${clip.promptText}.`,
    });

    if (clip.audioUrl) {
      segments.push({
        id: `prompt-audio-${clip.id}`,
        kind: 'audio',
        label: `Audio prompt: ${labelText}`,
        audioUrl: clip.audioUrl,
      });
    }
  });

  return segments;
}

export function PublicBookPage() {
  const { token } = useParams<{ token: string }>();
  const [book, setBook] = useState<PublicBookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('');
  const mountedRef = useRef(true);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void getPublicBookByToken(token)
      .then(setBook)
      .finally(() => setLoading(false));
  }, [token]);

  const playbackSegments = useMemo(() => (book ? buildAudiobookSegments(book) : []), [book]);

  const playSpeech = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const playAudio = useCallback((url: string) => {
    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      const done = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
        resolve();
      };

      audio.onended = done;
      audio.onerror = done;
      audio.onpause = () => {
        if (stopRequestedRef.current) done();
      };
      void audio.play().catch(done);
    });
  }, []);

  const stopPlayback = useCallback(() => {
    stopRequestedRef.current = true;
    currentAudioRef.current?.pause();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (mountedRef.current) {
      setIsPlaying(false);
      setNowPlaying('');
    }
  }, []);

  const handleAudiobookToggle = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!book || playbackSegments.length === 0) return;

    stopRequestedRef.current = false;
    setIsPlaying(true);

    void (async () => {
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        for (const segment of playbackSegments) {
          if (stopRequestedRef.current) break;
          setNowPlaying(segment.label);
          if (segment.kind === 'audio') {
            await playAudio(segment.audioUrl);
          } else {
            await playSpeech(segment.text);
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsPlaying(false);
          setNowPlaying('');
        }
        stopRequestedRef.current = false;
      }
    })();
  }, [isPlaying, stopPlayback, book, playbackSegments, playAudio, playSpeech]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRequestedRef.current = true;
      currentAudioRef.current?.pause();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-brand-600">Book not available</h1>
        <p className="mt-2 text-slate-600">
          This public link has expired or has not been generated yet.
        </p>
        <Link to="/login" className="btn-primary mt-6 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wide text-slate-500">Public photobook</p>
        <h1 className="text-3xl font-bold text-brand-600">{book.bookTitle}</h1>
        {book.description && <p className="mt-2 text-slate-600">{book.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={handleAudiobookToggle}>
            {isPlaying ? 'Stop audiobook' : 'Read as audiobook'}
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            {book.audioClips.length} clip{book.audioClips.length === 1 ? '' : 's'} available
          </span>
        </div>
        {nowPlaying && (
          <p className="mt-2 text-sm text-brand-700">
            Now playing: <span className="font-semibold">{nowPlaying}</span>
          </p>
        )}
      </header>

      <div className="space-y-4">
        {book.stories.map((story) => (
          <article key={story.id} className="card">
            <h2 className="text-lg font-semibold text-slate-900">{story.title}</h2>
            <p className="mt-1 text-xs text-slate-500">By {story.authorName}</p>
            {story.imageUrl && (
              <img
                src={story.imageUrl}
                alt={story.title}
                className="mt-3 h-52 w-full rounded-xl object-cover"
              />
            )}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {story.content}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
