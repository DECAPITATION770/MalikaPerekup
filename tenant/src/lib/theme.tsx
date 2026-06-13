/**
 * Theme preference: Auto / Light / Dark.
 *
 * "Auto" follows the ambient Telegram/system scheme (CLAUDE.md §15 — the Mini
 * App inherits Telegram's theme). Light/Dark let the user override it — the
 * choice is persisted to localStorage and re-applied before paint by the inline
 * script in index.html. This provider owns the `.light` class on <html>.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Monitor, Sun, Moon, type LucideIcon } from 'lucide-react';

import { syncTelegramChrome, useTgThemeBridge } from './telegram';

export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'tenant_theme';

export const THEME_ORDER: readonly ThemePref[] = ['auto', 'light', 'dark'];
export const THEME_ICON: Record<ThemePref, LucideIcon> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* private mode / quota — fall through to auto */
  }
  return 'auto';
}

interface ThemeCtx {
  pref: ThemePref;
  resolved: 'dark' | 'light';
  setPref: (p: ThemePref) => void;
  cycle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const auto = useTgThemeBridge(); // ambient scheme from Telegram / system
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const resolved: 'dark' | 'light' = pref === 'auto' ? auto : pref;

  useEffect(() => {
    document.documentElement.classList.toggle('light', resolved === 'light');
    // Recolour Telegram's header + bottom bar to match (no-op outside TG).
    syncTelegramChrome();
  }, [resolved]);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      if (p === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      /* ignore persistence failure */
    }
  };

  const cycle = () => {
    const i = THEME_ORDER.indexOf(pref);
    setPref(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
  };

  return (
    <Ctx.Provider value={{ pref, resolved, setPref, cycle }}>{children}</Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
