import { useEffect, useState } from 'react';
import { BilingualLine } from '@/components/BilingualText';
import { useAuth } from '@/context/AuthContext';
import { usePickText, useUiLocale } from '@/context/UiLocaleContext';
import { getOrCreateAlbumBookForCollab } from '@/services/books';
import { userDisplayName } from '@/lib/userDisplayName';
import type { AuthorBook, Book } from '@/types';
// CollaboratorAccessSection hidden — email collaborator invites deferred; use contributor invites instead.
// import { CollaboratorAccessSection } from './CollaboratorAccessSection';
import { ContributorInvitesSection } from './ContributorInvitesSection';
import { PublicLinksSection } from './PublicLinksSection';
import { BookPdfPreviewSection } from './BookPdfPreviewSection';

export function BookSharingSections({
  collabBook,
  albumBook: albumBookProp,
  onAlbumBookChange,
}: {
  collabBook: AuthorBook;
  albumBook?: Book | null;
  onAlbumBookChange?: (book: Book) => void;
}) {
  const { user, profile } = useAuth();
  const t = usePickText();
  const { locale } = useUiLocale();
  const [albumBook, setAlbumBook] = useState<Book | null>(albumBookProp ?? null);

  const isOwner = !!user && user.uid === collabBook.ownerId;

  useEffect(() => {
    if (albumBookProp !== undefined) {
      setAlbumBook(albumBookProp);
    }
  }, [albumBookProp]);

  useEffect(() => {
    if (albumBookProp !== undefined || !user) return;
    const name = userDisplayName(user, profile);
    getOrCreateAlbumBookForCollab(user.uid, collabBook, name)
      .then((book) => {
        setAlbumBook(book);
        onAlbumBookChange?.(book);
      })
      .catch(() => setAlbumBook(null));
  }, [albumBookProp, user, profile, collabBook, onAlbumBookChange]);

  const handleAlbumChange = (book: Book) => {
    setAlbumBook(book);
    onAlbumBookChange?.(book);
  };

  if (!isOwner) {
    return (
      <p className={`text-sm text-slate-600 ${locale === 'hi' ? 'font-hindi' : ''}`}>
        {t({
          en: 'You are a collaborator on this book. Only the owner can manage invites and public links.',
          hi: 'आप इस पुस्तक के सहयोगी हैं। केवल स्वामी आमंत्रण और सार्वजनिक लिंक प्रबंधित कर सकता है।',
        })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {albumBook && (
        <BookPdfPreviewSection albumBook={albumBook} collabBookId={collabBook.id} />
      )}
      <BilingualLine
        en="Invite family and friends to contribute stories, or share a public link."
        hi="परिवार और मित्रों को कहानियाँ जोड़ने के लिए आमंत्रित करें, या सार्वजनिक लिंक साझा करें।"
        enClass="text-sm text-slate-500"
        hiClass="text-sm text-slate-400"
      />
      <ContributorInvitesSection
        albumBookId={albumBook?.id ?? null}
        albumBookTitle={albumBook?.title ?? collabBook.title}
      />
      {/* Collaborator email invites hidden for now — re-enable CollaboratorAccessSection when co-edit is ready. */}
      <PublicLinksSection
        collabBook={collabBook}
        albumBook={albumBook}
        onAlbumBookChange={handleAlbumChange}
      />
    </div>
  );
}
