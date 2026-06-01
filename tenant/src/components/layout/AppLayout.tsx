import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlobalSearch } from '@/components/GlobalSearch';

/**
 * Root authenticated shell: desktop sidebar (md+); on mobile a slim top
 * AppHeader (brand + search + menu) and a bottom nav with the two money
 * actions. `pb-20` reserves space for the fixed bottom nav.
 */
export function AppLayout() {
  // Single instance of the global search palette mounted at the shell.
  // The keyboard shortcut (⌘K) was removed at partner request — palette
  // is opened only via explicit click on the Sidebar / AppHeader search
  // button. Kept here so the dialog reaches the React Router context.
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenSearch={() => setSearchOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden pb-20 md:pb-0">
          {/* No `container` class here on purpose — that Tailwind utility
              applies max-width: 1200px at xl, which left blank margins on
              the right side of every page on wide monitors. Pages now
              fill the entire content-area; per-page width constraints
              (if needed) live in the page itself, not in this shell.
              Tighter desktop horizontal padding (px-6 vs the old px-8)
              so the right gutter doesn't read as «empty field» — the
              sidebar already provides the left visual break.
              `overflow-x-hidden` on <main> + `min-w-0` on the column
              ensures any descendant min-content overflow gets clipped
              silently instead of pushing the whole page sideways and
              cutting off the right edge of the viewport. */}
          <div className="w-full px-4 py-6 md:px-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
