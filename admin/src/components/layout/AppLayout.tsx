import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import Sidebar from './Sidebar';
import OfflineBanner from '../OfflineBanner';

/**
 * Authenticated shell: fixed sidebar on the left, content column on the
 * right. The content column is full-width — per-page width constraints
 * (if any) live in the page itself, not in this shell.
 */
export default function AppLayout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
