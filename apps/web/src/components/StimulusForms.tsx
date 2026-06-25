import { useState } from 'react';
import { BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { PhotoPicker } from '@/components/PhotoPicker';
import { resolveImageContentType } from '@/lib/storageUpload';
import { usePickText } from '@/context/UiLocaleContext';
export { IMAGE_PROMPT_QUESTIONS } from '@/data/imagePromptQuestions';

export function DateModeButtons({
  dateMode,
  setDateMode,
}: {
  dateMode: 'none' | 'date' | 'year';
  setDateMode: (mode: 'none' | 'date' | 'year') => void;
}) {
  const t = usePickText();
  const labels: Record<'none' | 'date' | 'year', string> = {
    none: t({ en: 'Skip', hi: 'छोड़ें' }),
    date: t({ en: 'Full date', hi: 'पूरी तारीख' }),
    year: t({ en: 'Year only', hi: 'सिर्फ वर्ष' }),
  };

  return (
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
          {labels[mode]}
        </button>
      ))}
    </div>
  );
}

interface ImageMetadataFormProps {
  onContinue: (data: { file: File; date?: string; year?: number }) => void;
  submitting?: boolean;
}

export function ImageMetadataForm({ onContinue, submitting }: ImageMetadataFormProps) {
  const t = usePickText();
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
    const type = resolveImageContentType(file);
    const normalized =
      file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
    onContinue({
      file: normalized,
      date: dateMode === 'date' ? date : undefined,
      year: dateMode === 'year' ? parseInt(year, 10) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PhotoPicker onSelect={handleFileSelect} disabled={submitting} />
      {!file && (
        <p className="text-xs text-slate-500">
          <T en="Take a new photo or pick one from your gallery." hi="नई फोटो लें या गैलरी से चुनें।" />
        </p>
      )}
      {preview && (
        <img src={preview} alt="Preview" className="mx-auto max-h-48 w-full rounded-xl object-contain" />
      )}

      <div>
        <BilingualLine
          en="When was this?"
          hi="यह कब की है?"
          enClass="mb-2 text-sm font-medium text-slate-700"
          hiClass="mb-2 text-sm font-medium text-slate-700"
        />
        <DateModeButtons dateMode={dateMode} setDateMode={setDateMode} />
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
        {submitting ? (
          <BilingualBtn en="Uploading…" hi="अपलोड…" />
        ) : (
          <BilingualBtn en="Continue" hi="जारी रखें" />
        )}
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
          hiClass="mb-1 text-xs font-medium text-slate-600"
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
          hiClass="mb-2 text-sm font-medium text-slate-700"
        />
        <DateModeButtons dateMode={dateMode} setDateMode={setDateMode} />
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
        {submitting ? (
          <BilingualBtn en="Saving…" hi="सहेज रहे हैं…" />
        ) : (
          <BilingualBtn en="Save & Start Recording" hi="सहेजें और रिकॉर्ड शुरू" />
        )}
      </button>
    </form>
  );
}
