import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ContributorProvider } from '@/context/ContributorContext';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { RecordPage } from '@/pages/RecordPage';
import { StoriesPage } from '@/pages/StoriesPage';
import { StoryDetailPage } from '@/pages/StoryDetailPage';
import { StorySessionPage } from '@/pages/StorySessionPage';
import { StimuliPage } from '@/pages/StimuliPage';
import { AddStimulusPage } from '@/pages/AddStimulusPage';
import { BookManagePage } from '@/pages/BookManagePage';
import { PublicBookPage } from '@/pages/PublicBookPage';
import { PublicBrowsePage } from '@/pages/PublicBrowsePage';
import { BookAlbumPreviewPage } from '@/pages/BookAlbumPreviewPage';
import { ClipListenPage } from '@/pages/ClipListenPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ContributeLandingPage, ContributeHubPage } from '@/pages/ContributePages';
import {
  ContributeRecordPage,
  ContributeAddPhotoPage,
  ContributeAddTextPage,
} from '@/pages/ContributeActionPages';
import { ContributeStoryPage } from '@/pages/ContributeStoryPage';
import { BooksPage } from '@/pages/BooksPage';
import { ContributorHomePage } from '@/pages/ContributorHomePage';
import { InvitationsPage } from '@/pages/InvitationsPage';
import { InvitationLinkPage } from '@/pages/InvitationLinkPage';
import { PhotosPage } from '@/pages/PhotosPage';
import { AboutPage } from '@/pages/AboutPage';
import { TermsPage } from '@/pages/TermsPage';
import { PrivacyPage } from '@/pages/PrivacyPage';

function ContributeRoutes() {
  return (
    <ContributorProvider>
      <Routes>
        <Route path="/" element={<ContributeLandingPage />} />
        <Route path="/hub" element={<ContributeHubPage />} />
        <Route path="/record" element={<ContributeRecordPage />} />
        <Route path="/add-photo" element={<ContributeAddPhotoPage />} />
        <Route path="/add-text" element={<ContributeAddTextPage />} />
        <Route path="/story/:sessionId" element={<ContributeStoryPage />} />
      </Routes>
    </ContributorProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/invite/:token" element={<InvitationLinkPage />} />
      <Route path="/browse/:token" element={<PublicBrowsePage />} />
      <Route path="/read/:bookSlug/listen/:clipId" element={<ClipListenPage />} />
      <Route path="/read/:bookSlug" element={<PublicBookPage />} />
      <Route path="/read/:bookSlug/:storySlug" element={<PublicBookPage />} />
      <Route path="/contribute/:inviteSlug/*" element={<ContributeRoutes />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/contribute" element={<ContributorHomePage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/prompts" element={<StimuliPage />} />
        <Route path="/photos" element={<PhotosPage />} />
        <Route path="/add-stimulus" element={<AddStimulusPage />} />
        <Route path="/book" element={<BookManagePage />} />
        <Route path="/book/album" element={<BookAlbumPreviewPage />} />
        <Route path="/story/:sessionId" element={<StorySessionPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/stories/:sessionId" element={<StoryDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
