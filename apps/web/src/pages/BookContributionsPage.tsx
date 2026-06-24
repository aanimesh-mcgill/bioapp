import { useEffect, useMemo, useState } from 'react';
import { BookSwitcher } from '@/components/BookSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useBook } from '@/context/BookContext';
import { buildPhotobookPdf } from '@/lib/photobookPdf';
import {
  createBookStory,
  subscribeToBookAudioClips,
  subscribeToBookStories,
  updateBookStory,
  uploadBookAudioClip,
} from '@/services/booksCollaboration';
import type { BookAudioClip, BookStory, PromptType } from '@/types';

export function BookContributionsPage() {
  const { user, profile } = useAuth();
  const { activeBook } = useBook();

  const [stories, setStories] = useState<BookStory[]>([]);
  const [clips, setClips] = useState<BookAudioClip[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [storyStatus, setStoryStatus] = useState<BookStory['status']>('draft');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [storyError, setStoryError] = useState('');
  const [savingStory, setSavingStory] = useState(false);

  const [promptType, setPromptType] = useState<PromptType>('text');
  const [promptText, setPromptText] = useState('');
  const [promptImageUrl, setPromptImageUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadingClip, setUploadingClip] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);
  const [clipError, setClipError] = useState('');

  const [pdfDrafts, setPdfDrafts] = useState<Record<string, string>>({});
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!activeBook) {
      setStories([]);
      return;
    }
    return subscribeToBookStories(activeBook.id, setStories);
  }, [activeBook]);

  useEffect(() => {
    if (!activeBook) {
      setClips([]);
      return;
    }
    return subscribeToBookAudioClips(activeBook.id, setClips);
  }, [activeBook]);

  useEffect(() => {
    setPdfDrafts((prev) => {
      const next = { ...prev };
      stories.forEach((story) => {
        if (!(story.id in next)) {
          next[story.id] = story.content;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!stories.some((story) => story.id === key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [stories]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const repeatingClips = useMemo(() => {
    if (clips.length === 0) return [];
    return [...clips, ...clips, ...clips];
  }, [clips]);

  const clearStoryEditor = () => {
    setEditingStoryId(null);
    setTitle('');
    setContent('');
    setImageUrl('');
    setStoryStatus('draft');
  };

  const handleEditStory = (story: BookStory) => {
    setEditingStoryId(story.id);
    setTitle(story.title);
    setContent(story.content);
    setImageUrl(story.imageUrl ?? '');
    setStoryStatus(story.status);
    setStoryError('');
  };

  const handleSaveStory = async () => {
    if (!activeBook || !user || !profile || !title.trim() || !content.trim()) return;
    setSavingStory(true);
    setStoryError('');
    try {
      if (editingStoryId) {
        await updateBookStory(editingStoryId, {
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl.trim(),
          status: storyStatus,
        });
      } else {
        await createBookStory({
          bookId: activeBook.id,
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl.trim(),
          status: storyStatus,
          authorId: user.uid,
          authorName: profile.displayName || profile.email,
        });
      }
      clearStoryEditor();
    } catch {
      setStoryError('Could not save this story. Please retry.');
    } finally {
      setSavingStory(false);
    }
  };

  const handleUploadClip = async () => {
    if (!activeBook || !user || !profile || !audioFile || !promptText.trim()) return;
    setUploadingClip(true);
    setClipError('');
    try {
      await uploadBookAudioClip(
        {
          bookId: activeBook.id,
          file: audioFile,
          promptType,
          promptText: promptText.trim(),
          imageUrl: promptImageUrl.trim(),
          createdBy: user.uid,
          createdByName: profile.displayName || profile.email,
        },
        setClipProgress,
      );
      setAudioFile(null);
      setPromptText('');
      setPromptImageUrl('');
      setClipProgress(0);
    } catch {
      setClipError('Audio upload failed. Please try another file.');
    } finally {
      setUploadingClip(false);
    }
  };

  const generatePdfBlob = async () => {
    if (!activeBook) throw new Error('No book selected');
    const blob = await buildPhotobookPdf({
      bookTitle: activeBook.title,
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        content: pdfDrafts[story.id] ?? story.content,
        imageUrl: story.imageUrl,
        authorName: story.authorName,
      })),
    });
    return blob;
  };

  const handlePreviewPdf = async () => {
    if (!activeBook || stories.length === 0) return;
    setPdfLoading(true);
    try {
      const blob = await generatePdfBlob();
      const nextUrl = URL.createObjectURL(blob);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(nextUrl);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeBook || stories.length === 0) return;
    setPdfLoading(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${activeBook.title.replace(/\s+/g, '-').toLowerCase()}-photobook.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-600">Book Contributions</h1>
      <BookSwitcher />

      {!activeBook && (
        <div className="card text-sm text-slate-600">
          Create your first book to start adding stories and audio clips.
        </div>
      )}

      {activeBook && (
        <>
          <section className="card mb-4 space-y-3">
            <h2 className="text-base font-semibold text-slate-800">
              {editingStoryId ? 'Edit contribution' : 'Add contribution'} for "{activeBook.title}"
            </h2>
            <input
              className="input-field"
              placeholder="Story title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              className="input-field min-h-[140px] resize-y"
              placeholder="Write your story section"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <input
              className="input-field"
              placeholder="Optional image URL for this story page"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn-secondary flex-1 ${storyStatus === 'draft' ? 'bg-brand-50' : ''}`}
                onClick={() => setStoryStatus('draft')}
              >
                Save as draft
              </button>
              <button
                type="button"
                className={`btn-secondary flex-1 ${storyStatus === 'submitted' ? 'bg-brand-50' : ''}`}
                onClick={() => setStoryStatus('submitted')}
              >
                Mark submitted
              </button>
            </div>
            {storyError && <p className="text-sm text-red-600">{storyError}</p>}
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                disabled={savingStory || !title.trim() || !content.trim()}
                onClick={handleSaveStory}
              >
                {savingStory ? 'Saving…' : editingStoryId ? 'Update Story' : 'Add Story'}
              </button>
              {editingStoryId && (
                <button className="btn-secondary flex-1" onClick={clearStoryEditor}>
                  Cancel edit
                </button>
              )}
            </div>
          </section>

          <section className="card mb-4">
            <h2 className="mb-3 text-base font-semibold text-slate-800">All stories in this book</h2>
            {stories.length === 0 ? (
              <p className="text-sm text-slate-500">
                No stories yet. Add the first story section above.
              </p>
            ) : (
              <div className="space-y-3">
                {stories.map((story) => (
                  <article key={story.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{story.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          story.status === 'submitted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {story.status}
                      </span>
                    </div>
                    <p className="max-h-28 overflow-hidden whitespace-pre-wrap text-sm text-slate-700">
                      {story.content}
                    </p>
                    {story.imageUrl && (
                      <img
                        src={story.imageUrl}
                        alt={story.title}
                        className="mt-2 h-36 w-full rounded-lg object-cover"
                      />
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>By {story.authorName}</span>
                      <button
                        className="font-semibold text-brand-600"
                        onClick={() => handleEditStory(story)}
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card mb-4 space-y-3">
            <h2 className="text-base font-semibold text-slate-800">
              Audio clips for text/image prompts
            </h2>
            <label className="block text-sm font-medium text-slate-700">
              Prompt type
              <select
                className="input-field mt-1"
                value={promptType}
                onChange={(event) => setPromptType(event.target.value as PromptType)}
              >
                <option value="text">Text prompt</option>
                <option value="image">Image prompt</option>
              </select>
            </label>
            <input
              className="input-field"
              placeholder={promptType === 'image' ? 'Image prompt label' : 'Text prompt'}
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
            />
            <input
              className="input-field"
              placeholder="Optional prompt image URL"
              value={promptImageUrl}
              onChange={(event) => setPromptImageUrl(event.target.value)}
            />
            <input
              className="input-field"
              type="file"
              accept="audio/*"
              onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
            />
            {uploadingClip && (
              <p className="text-xs text-slate-500">Uploading clip… {Math.round(clipProgress)}%</p>
            )}
            {clipError && <p className="text-sm text-red-600">{clipError}</p>}
            <button
              className="btn-primary w-full"
              disabled={uploadingClip || !audioFile || !promptText.trim()}
              onClick={handleUploadClip}
            >
              {uploadingClip ? 'Uploading…' : 'Upload audio clip'}
            </button>

            <div className="overflow-x-auto pt-2">
              <div className="flex min-w-max gap-3">
                {repeatingClips.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Add clips and they will appear in an infinite horizontal stream.
                  </p>
                )}
                {repeatingClips.map((clip, index) => (
                  <article
                    key={`${clip.id}-${index}`}
                    className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {clip.promptType} prompt
                    </p>
                    <p className="mb-2 text-sm text-slate-700">{clip.promptText}</p>
                    {clip.imageUrl && (
                      <img
                        src={clip.imageUrl}
                        alt={clip.promptText}
                        className="mb-2 h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    <audio controls src={clip.audioUrl} className="w-full" />
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="card space-y-3">
            <h2 className="text-base font-semibold text-slate-800">Photobook PDF preview & edit</h2>
            <p className="text-sm text-slate-600">
              Edit text below before rendering PDF pages. Images are pulled from each story.
            </p>

            {stories.map((story) => (
              <div key={story.id} className="rounded-xl border border-slate-200 p-3">
                <p className="mb-1 text-sm font-semibold text-slate-800">{story.title}</p>
                <textarea
                  className="input-field min-h-[90px] resize-y"
                  value={pdfDrafts[story.id] ?? ''}
                  onChange={(event) =>
                    setPdfDrafts((prev) => ({ ...prev, [story.id]: event.target.value }))
                  }
                />
              </div>
            ))}

            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                disabled={pdfLoading || stories.length === 0}
                onClick={handlePreviewPdf}
              >
                {pdfLoading ? 'Generating…' : 'Preview PDF'}
              </button>
              <button
                className="btn-secondary flex-1"
                disabled={pdfLoading || stories.length === 0}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </button>
            </div>

            {pdfPreviewUrl && (
              <iframe
                title="Photobook PDF preview"
                src={pdfPreviewUrl}
                className="h-[480px] w-full rounded-xl border border-slate-200"
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
