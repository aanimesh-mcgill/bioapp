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
      <Route path="/read/:bookSlug/listen/:clipId" element={<ClipListenPage />} />
      <Route path="/read/:bookSlug" element={<PublicBookPage />} />
      <Route path="/read/:bookSlug/:storySlug" element={<PublicBookPage />} />
      <Route path="/contribute/:inviteSlug/*" element={<ContributeRoutes />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/prompts" element={<StimuliPage />} />
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
