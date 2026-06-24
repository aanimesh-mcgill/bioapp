import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { RecordPage } from '@/pages/RecordPage';
import { StoriesPage } from '@/pages/StoriesPage';
import { StoryDetailPage } from '@/pages/StoryDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BooksPage } from '@/pages/BooksPage';
import { BookContributionsPage } from '@/pages/BookContributionsPage';
import { InvitationsPage } from '@/pages/InvitationsPage';
import { InvitationLinkPage } from '@/pages/InvitationLinkPage';
import { PublicBookPage } from '@/pages/PublicBookPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitationLinkPage />} />
      <Route path="/browse/:token" element={<PublicBookPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/contribute" element={<BookContributionsPage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/stories/:storyId" element={<StoryDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
