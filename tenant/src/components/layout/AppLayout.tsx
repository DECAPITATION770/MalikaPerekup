import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar />
      {/* pb-24 на мобиле: BottomNav h-16 + FAB выступает на ~16px над навбаром, плюс safe-area inset.
          На десктопе sidebar справа от main, нижний gap не нужен. */}
      <main className="flex-1 min-w-0 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
