/**
 * Theme preference for the admin panel.
 *
 * Three modes: Auto / Light / Dark. Auto follows the OS via
 * `prefers-color-scheme`. The choice persists in localStorage and is
 * re-applied before the first paint by an inline script in `index.html`
 * to avoid the dark-flash on light-mode load. This provider owns the
 * `.light` class on <html>.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Monitor, Sun, Moon, type LucideIcon } from 'lucide-react';

export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'admin_theme';

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
    /* private mode — fall through */
  }
  return 'auto';
}

function readSystem(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeCtx {
  pref: ThemePref;
  resolved: 'dark' | 'light';
  setPref: (p: ThemePref) => void;
  cycle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [systemScheme, setSystemScheme] = useState<'dark' | 'light'>(readSystem);
  const resolved: 'dark' | 'light' = pref === 'auto' ? systemScheme : pref;

  // Track system scheme changes — used only when pref === 'auto'.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemScheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', resolved === 'light');
  }, [resolved]);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      if (p === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
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
