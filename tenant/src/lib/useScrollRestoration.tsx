import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Manual scroll restoration for the BrowserRouter setup.
 *
 * The data-router's built-in `<ScrollRestoration />` requires
 * `createBrowserRouter`, which the app doesn't use — switching the whole
 * router for one feature isn't worth it. This component reads/writes
 * sessionStorage by pathname so a user who scrolls deep into Stock, opens
 * a StockDetail, and taps Back lands where they were instead of being
 * yanked to the top.
 *
 * Behaviour:
 *   PUSH/REPLACE — scroll to top (fresh navigation expects a top-fold start).
 *   POP          — restore the scrollY snapshot saved when the user last
 *                  left this pathname, deferred to rAF so the lazy-Suspense
 *                  route has time to commit.
 *
 * Storage is keyed by pathname rather than the volatile history `key` so
 * the snapshot survives a History POP that some browsers materialise as a
 * fresh entry.
 */
const STORAGE_KEY = (pathname: string) => `scroll:${pathname}`;

export function ScrollRestoration() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  // Save current scrollY when the user leaves this pathname. The cleanup
  // also runs on unmount, which covers the full-app close case.
  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(STORAGE_KEY(pathname), String(window.scrollY));
      } catch {
        // Private-mode / quota-exceeded — fail silently and lose the snapshot.
      }
    };
  }, [pathname]);

  // Apply the policy after each navigation lands.
  useEffect(() => {
    if (navType === 'POP') {
      const saved = sessionStorage.getItem(STORAGE_KEY(pathname));
      if (saved) {
        const y = Number(saved) || 0;
        // Defer one frame: lazy routes suspend, content arrives later, the
        // immediate scrollTo would hit an empty document and snap to 0.
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, navType]);

  return null;
}
