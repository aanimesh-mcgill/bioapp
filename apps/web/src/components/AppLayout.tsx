import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ActiveBookBar } from '@/components/ActiveBookBar';
import { BottomNav } from '@/components/BottomNav';

export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <div className="relative mx-auto min-h-dvh max-w-lg bg-heritage-cream pb-24">
        <ActiveBookBar />
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}
