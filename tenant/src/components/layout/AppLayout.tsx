import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';

/**
 * Root authenticated shell: desktop sidebar (md+); on mobile a slim top
 * AppHeader (brand + search + menu) and a bottom nav with the two money
 * actions. `pb-20` reserves space for the fixed bottom nav.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <div className="container px-4 py-6 md:px-8 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
