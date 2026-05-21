import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import Sidebar from './Sidebar';
import OfflineBanner from '../OfflineBanner';

export default function AppLayout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <OfflineBanner />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
