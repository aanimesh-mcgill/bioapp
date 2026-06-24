import { useState } from 'react';
import { BilingualLine } from '@/components/BilingualText';
import { PhotoPicker } from '@/components/PhotoPicker';
export { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';

interface ImageMetadataFormProps {
  onContinue: (data: { file: File; date?: string; year?: number }) => void;
  submitting?: boolean;
}

export function ImageMetadataForm({ onContinue, submitting }: ImageMetadataFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<'none' | 'date' | 'year'>('none');
  const [date, setDate] = useState('');
  const [year, setYear] = useState('');

  const handleFileSelect = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    onContinue({
      file,
      date: dateMode === 'date' ? date : undefined,
      year: dateMode === 'year' ? parseInt(year, 10) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PhotoPicker onSelect={handleFileSelect} disabled={submitting} />
      {!file && (
        <p className="text-xs text-slate-500">
          Take a new photo or pick one from your gallery.
          <span className="font-hindi block text-slate-400">नई फोटो लें या गैलरी से चुनें।</span>
        </p>
      )}
      {preview && (
        <img src={preview} alt="Preview" className="max-h-[70vh] w-full rounded-xl object-contain" />
      )}

      <div>
        <BilingualLine
          en="When was this?"
          hi="यह कब की है?"
          enClass="mb-2 text-sm font-medium text-slate-700"
          hiClass="mb-1 text-xs text-slate-400"
        />
        <div className="flex gap-2">
          {(['none', 'date', 'year'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                dateMode === mode ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setDateMode(mode)}
            >
              {mode === 'none' ? 'Skip / छोड़ें' : mode === 'date' ? 'Full date / पूरी तारीख' : 'Year only / सिर्फ वर्ष'}
            </button>
          ))}
        </div>
        {dateMode === 'date' && (
          <input type="date" className="input-field mt-2" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        {dateMode === 'year' && (
          <input
            type="number"
            className="input-field mt-2"
            placeholder="e.g. 1985"
            min="1900"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        )}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={submitting || !file}>
        {submitting ? 'Uploading… / अपलोड…' : 'Continue / जारी रखें'}
      </button>
    </form>
  );
}

interface TextStimulusFormProps {
  onSubmit: (data: { content: string; date?: string; year?: number }) => void;
  submitting?: boolean;
}

export function TextStimulusForm({ onSubmit, submitting }: TextStimulusFormProps) {
  const [content, setContent] = useState('');
  const [dateMode, setDateMode] = useState<'none' | 'date' | 'year'>('none');
  const [date, setDate] = useState('');
  const [year, setYear] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({
      content: content.trim(),
      date: dateMode === 'date' ? date : undefined,
      year: dateMode === 'year' ? parseInt(year, 10) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <BilingualLine
          en="Write a memory, quote, note, or prompt to respond to…"
          hi="कोई याद, उद्धरण, नोट या प्रश्न लिखें…"
          enClass="mb-1 text-xs font-medium text-slate-600"
          hiClass="mb-1 text-xs text-slate-400"
        />
        <textarea
          className="input-field min-h-[120px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </label>

      <div>
        <BilingualLine
          en="When? (optional)"
          hi="कब? (वैकल्पिक)"
          enClass="mb-2 text-sm font-medium text-slate-700"
          hiClass="mb-1 text-xs text-slate-400"
        />
        <div className="flex gap-2">
          {(['none', 'date', 'year'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                dateMode === mode ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setDateMode(mode)}
            >
              {mode === 'none' ? 'Skip / छोड़ें' : mode === 'date' ? 'Full date / पूरी तारीख' : 'Year only / सिर्फ वर्ष'}
            </button>
          ))}
        </div>
        {dateMode === 'date' && (
          <input type="date" className="input-field mt-2" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        {dateMode === 'year' && (
          <input
            type="number"
            className="input-field mt-2"
            placeholder="e.g. 1990"
            min="1900"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        )}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={submitting || !content.trim()}>
        {submitting ? 'Saving… / सहेज रहे हैं…' : 'Save & Start Recording / सहेजें और रिकॉर्ड शुरू'}
      </button>
    </form>
  );
}
