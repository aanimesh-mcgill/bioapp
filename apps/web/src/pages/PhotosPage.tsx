import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { BilingualBtn, BilingualLine, T } from '@/components/BilingualText';
import { HeritagePageTitle } from '@/components/heritage/HeritageHeader';
import { BookPhotoImage } from '@/components/BookPhotoImage';
import { PhotoPicker } from '@/components/PhotoPicker';
import { DateModeButtons } from '@/components/StimulusForms';
import { useBookPhotos } from '@/hooks/useBookPhotos';
import {
  deleteBookPhoto,
  inventoryPhotos,
  pendingPhotoCount,
  pruneInventoryPhotosWithFinishedStories,
  uploadBookPhoto,
} from '@/services/bookPhotos';
import { preparePhotoFileForUpload } from '@/lib/storageUpload';

export function PhotosPage() {
  const { user } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const { photos, loading, activeBook, bookId, userId } = useBookPhotos();
  const galleryRef = useRef<HTMLInputElement>(null);

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [dateMode, setDateMode] = useState<'none' | 'date' | 'year'>('none');
  const [date, setDate] = useState('');
  const [year, setYear] = useState('');

  const inventory = inventoryPhotos(photos);
  const toRecord = pendingPhotoCount(photos);

  useEffect(() => {
    if (!bookId || photos.length === 0) return;
    void pruneInventoryPhotosWithFinishedStories(bookId, photos);
  }, [bookId, photos]);

  const uploadMeta = () => ({
    date: dateMode === 'date' ? date : undefined,
    year: dateMode === 'year' ? parseInt(year, 10) : undefined,
  });

  const handleFile = async (file: File) => {
    if (!bookId || !userId) return;
    setAdding(true);
    setError('');
    try {
      const normalized = await preparePhotoFileForUpload(file);
      await uploadBookPhoto(bookId, userId, normalized, uploadMeta());
      setDateMode('none');
      setDate('');
      setYear('');
    } catch (err) {
      console.error(err);
      setError(t({ en: 'Could not add photo.', hi: 'फोटो नहीं जोड़ सके।' }));
    } finally {
      setAdding(false);
    }
  };

  const handleGalleryMulti = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !bookId || !userId) return;
    setAdding(true);
    setError('');
    try {
      let failed = 0;
      for (const file of Array.from(files)) {
        try {
          const normalized = await preparePhotoFileForUpload(file);
          await uploadBookPhoto(bookId, userId, normalized, uploadMeta());
        } catch (err) {
          console.error(err);
          failed += 1;
        }
      }
      if (failed === files.length) {
        setError(t({ en: 'Could not add photos.', hi: 'फोटो नहीं जोड़ सके।' }));
      } else if (failed > 0) {
        setError(
          t({
            en: `${files.length - failed} added, ${failed} failed.`,
            hi: `${files.length - failed} जोड़ी गईं, ${failed} विफल।`,
          }),
        );
      }
      setDateMode('none');
      setDate('');
      setYear('');
    } catch (err) {
      console.error(err);
      setError(t({ en: 'Could not add photos.', hi: 'फोटो नहीं जोड़ सके।' }));
    } finally {
      setAdding(false);
      e.target.value = '';
    }
  };

  const handleRemove = async (photoId: string) => {
    if (!bookId) return;
    if (!window.confirm(t({ en: 'Remove this photo from your library?', hi: 'इस फोटो को हटाएं?' }))) {
      return;
    }
    await deleteBookPhoto(bookId, photoId);
  };

  if (!user) return null;

  if (!activeBook) {
    return (
      <div className="heritage-page flex min-h-[40vh] flex-col items-center justify-center text-center">
        <HeritagePageTitle en="Photos" hi="फोटो" />
        <p className="mt-3 text-sm text-heritage-muted">
          <T en="Choose a book in Library first." hi="पहले पुस्तकालय में पुस्तक चुनें।" />
        </p>
        <Link to="/books" className="btn-primary mt-4">
          <BilingualBtn en="Go to Library" hi="पुस्तकालय पर जाएं" />
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="heritage-page flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="heritage-page">
      <HeritagePageTitle
        en="Photos"
        hi="फोटो"
        subtitle={{ en: activeBook.title, hi: activeBook.title }}
      />

      <p className={`mb-4 text-sm text-heritage-muted ${locale === 'hi' ? 'font-hindi' : ''}`}>
        {t({
          en: 'Add photos to your library. Record stories from them on Home, one at a time.',
          hi: 'अपनी पुस्तक में फोटो जोड़ें। होम पर एक-एक करके कहानी रिकॉर्ड करें।',
        })}
      </p>

      {inventory.length > 0 && (
        <p className="mb-4 text-xs font-medium text-brand-700">
          {t({
            en: `${inventory.length} in library · ${toRecord} to record on Home`,
            hi: `${inventory.length} संग्रह में · ${toRecord} होम पर रिकॉर्ड बाकी`,
          })}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="card mb-6 space-y-4">
        <p className="heritage-label text-brand-600">
          <T en="Add photos" hi="फोटो जोड़ें" />
        </p>
        <PhotoPicker onSelect={handleFile} disabled={adding} />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleGalleryMulti}
          disabled={adding}
        />
        <button
          type="button"
          className="btn-secondary w-full text-sm"
          disabled={adding}
          onClick={() => galleryRef.current?.click()}
        >
          <BilingualBtn en="Choose multiple from gallery" hi="गैलरी से कई चुनें" />
        </button>

        <div>
          <BilingualLine
            en="When was this? (optional, for photos you add now)"
            hi="यह कब की है? (वैकल्पिक)"
            enClass="mb-2 text-sm font-medium text-slate-700"
            hiClass="mb-2 text-sm font-medium text-slate-700"
          />
          <DateModeButtons dateMode={dateMode} setDateMode={setDateMode} />
          {dateMode === 'date' && (
            <input
              type="date"
              className="input-field mt-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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

        {adding && (
          <p className="text-center text-sm text-heritage-muted">
            <T en="Uploading…" hi="अपलोड हो रहा…" />
          </p>
        )}
      </section>

      {inventory.length > 0 ? (
        <section className="card mb-6">
          <p className="heritage-label mb-1 text-brand-600">
            <T en="Photo library" hi="फोटो संग्रह" />
          </p>
          <p className="mb-4 text-xs text-heritage-muted">
            <T
              en="All photos waiting for a story. Go to Home to record — each disappears once its story is saved."
              hi="सभी फोटो जिनकी कहानी बाकी है। होम पर रिकॉर्ड करें — कहानी सहेजते ही हट जाएंगी।"
            />
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {inventory.map((photo) => (
              <li key={photo.id}>
                <div className="overflow-hidden rounded-xl bg-heritage-paper ring-1 ring-heritage-line">
                  <BookPhotoImage photo={photo} className="!min-h-0 !max-h-28" />
                </div>
                {photo.status === 'in_progress' && (
                  <p className="mt-1 text-center text-[10px] font-medium text-amber-700">
                    <T en="Draft on Home" hi="होम पर ड्राफ्ट" />
                  </p>
                )}
                <button
                  type="button"
                  className="mt-1 w-full text-center text-[10px] text-heritage-muted underline"
                  onClick={() => void handleRemove(photo.id)}
                >
                  <T en="Remove" hi="हटाएं" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="card py-10 text-center">
          <span className="mb-3 block text-4xl">📷</span>
          <p className="text-sm text-heritage-muted">
            <T en="No photos yet. Add some above." hi="अभी कोई फोटो नहीं। ऊपर जोड़ें।" />
          </p>
        </div>
      )}
    </div>
  );
}
