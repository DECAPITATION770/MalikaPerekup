import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';

/**
 * Root authenticated shell: desktop sidebar (md+), main content with max-w
 * + padding, and mobile bottom-nav. `pb-24` on mobile reserves space for
 * the FAB that overshoots the nav bar.
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh flex bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-0">
        <div className="container px-4 md:px-8 py-6 md:py-10">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
