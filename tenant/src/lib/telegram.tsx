/**
 * Telegram Mini App SDK adapter.
 *
 * Wraps `@telegram-apps/sdk-react` v3 with a defensive layer so the app
 * still works when opened outside Telegram (e.g. dev in a normal browser).
 *
 * Every hook returns a no-op fallback if the SDK fails to initialize, so
 * callers don't need to gate every UI action behind environment checks.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  init as initSdk,
  backButton,
  mainButton,
  hapticFeedback,
  qrScanner,
  themeParams,
  viewport,
  miniApp,
} from '@telegram-apps/sdk-react';

// ── Environment detection ──────────────────────────────────────────────────

/** True iff we're running inside Telegram (initData is present). */
export function isTelegramEnvironment(): boolean {
  // The SDK sets `window.Telegram.WebApp` and parses launch params from the URL
  // hash. The most reliable signal is presence of `tgWebAppPlatform` in URL.
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    /tgWebAppPlatform/.test(hash) ||
    /tgWebAppPlatform/.test(search) ||
    Boolean((window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp)
  );
}

// ── Initialization ─────────────────────────────────────────────────────────

interface TgState {
  ready: boolean;
  inTelegram: boolean;
  /** True only once the native MainButton actually mounted — gate for hiding
   *  in-page submit buttons so a flaky webview never strands the user. */
  mainButtonMounted: boolean;
  error: string | null;
}

const TgContext = createContext<TgState>({
  ready: false,
  inTelegram: false,
  mainButtonMounted: false,
  error: null,
});

export function TelegramProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<TgState>({
    ready: false,
    inTelegram: false,
    mainButtonMounted: false,
    error: null,
  });

  useEffect(() => {
    const inTg = isTelegramEnvironment();
    if (!inTg) {
      setState({ ready: true, inTelegram: false, mainButtonMounted: false, error: null });
      return;
    }
    try {
      initSdk();

      // Mount the components we'll subscribe to. Each `.mount()` is idempotent.
      if (miniApp.mount.isAvailable()) miniApp.mount();
      if (backButton.mount.isAvailable()) backButton.mount();
      if (mainButton.mount.isAvailable()) mainButton.mount();
      if (themeParams.mount.isAvailable()) themeParams.mount();
      if (viewport.mount.isAvailable()) {
        // viewport.mount() may return a Promise — that's OK, fire-and-forget.
        Promise.resolve(viewport.mount()).catch(() => {
          /* swallow — non-critical */
        });
      }

      // Expand to full height by default — perekupshchik needs the screen.
      if (viewport.expand.isAvailable()) viewport.expand();

      setState({
        ready: true,
        inTelegram: true,
        mainButtonMounted: mainButton.isMounted?.() ?? false,
        error: null,
      });
    } catch (err) {
      setState({
        ready: true,
        inTelegram: false,
        mainButtonMounted: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return <TgContext.Provider value={state}>{children}</TgContext.Provider>;
}

export function useTelegram(): TgState {
  return useContext(TgContext);
}

// ── Telegram chrome sync ─────────────────────────────────────────────────
// Telegram owns its own header bar + the bottom strip behind the MainButton.
// By default they keep Telegram's theme colour, so when the app renders in a
// theme that differs from the Telegram client (e.g. app light inside a dark
// Telegram, or vice-versa) the bars look "unsynced". Push the app's own
// background colour into Telegram's chrome whenever the resolved theme changes.

function _cssVarHex(name: string, fallback: `#${string}`): `#${string}` {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = raw.match(/(\d+)\s+(\d+)\s+(\d+)/);
  if (!m) return fallback;
  const hex = [m[1], m[2], m[3]]
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

/** Recolour Telegram's header / background / bottom bar to match the app's
 *  current theme. No-op outside Telegram or on clients that don't support it. */
export function syncTelegramChrome(): void {
  const bg = _cssVarHex('--c-bg', '#15120e');
  const header = _cssVarHex('--c-bg2', bg);
  try {
    if (miniApp.setBackgroundColor.isAvailable?.()) miniApp.setBackgroundColor(bg);
    if (miniApp.setHeaderColor.isAvailable?.()) miniApp.setHeaderColor(header);
    if (miniApp.setBottomBarColor.isAvailable?.()) miniApp.setBottomBarColor(bg);
  } catch {
    /* not in Telegram or method unsupported on this client */
  }
}

// ── Theme bridge: subscribe to themeParams.colorScheme and apply .light class

export function useTgThemeBridge(): 'dark' | 'light' {
  const { inTelegram } = useTelegram();
  // Dark-first (CLAUDE.md §15): outside Telegram the ambient default is always
  // dark — perekupshchik reads the screen under bright market sun, so we never
  // start light just because the host OS prefers light. Inside Telegram we still
  // inherit the user's deliberate Telegram theme choice (see effect below). The
  // user can override either way via the theme toggle (persisted in theme.tsx).
  const [scheme, setScheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!inTelegram) {
      // Outside TG: stay dark-first, ignore prefers-color-scheme.
      setScheme('dark');
      return;
    }

    const detectFromTg = () => {
      // `themeParams.state()` returns the full snapshot. Background lightness
      // is the most reliable signal.
      const state = themeParams.state();
      const bg = state?.bg_color;
      if (typeof bg !== 'string') return 'dark';
      // Quick brightness heuristic: parse #rrggbb → luminance > 0.5 = light
      const m = /^#?([0-9a-f]{6})$/i.exec(bg);
      if (!m) return 'dark';
      const n = parseInt(m[1], 16);
      const r = (n >> 16) & 0xff;
      const g = (n >> 8) & 0xff;
      const b = n & 0xff;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum > 0.5 ? 'light' : 'dark';
    };

    setScheme(detectFromTg());
    // Subscribe to changes
    const unsub = themeParams.state.sub?.(() => setScheme(detectFromTg()));
    return () => unsub?.();
  }, [inTelegram]);

  // Class application is owned by ThemeProvider (src/lib/theme.tsx), which
  // combines this detected scheme with the user's manual override. This hook
  // now only *detects* the ambient Telegram/system scheme.
  return scheme;
}

// ── Back button hook ───────────────────────────────────────────────────────

/**
 * Show TG BackButton and bind a callback. Auto-hides on unmount.
 * No-op outside Telegram (your app should still wire a fallback button).
 */
export function useTgBackButton(handler: (() => void) | null) {
  useEffect(() => {
    if (!handler || !backButton.isMounted?.()) return;

    if (backButton.show.isAvailable()) backButton.show();

    const off = backButton.onClick.isAvailable() ? backButton.onClick(handler) : null;
    return () => {
      off?.();
      if (backButton.hide.isAvailable()) backButton.hide();
    };
  }, [handler]);
}

// ── Main button hook ───────────────────────────────────────────────────────

interface MainButtonOpts {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isEnabled?: boolean;
  isLoaderVisible?: boolean;
  backgroundColor?: `#${string}`;
  textColor?: `#${string}`;
}

/**
 * Set TG MainButton params + click handler. Auto-hides on unmount.
 * Pass `isVisible: false` to keep params updated but the button hidden.
 */
export function useTgMainButton(opts: MainButtonOpts | null) {
  useEffect(() => {
    if (!opts) {
      if (mainButton.isMounted?.() && mainButton.setParams.isAvailable()) {
        mainButton.setParams({ isVisible: false });
      }
      return;
    }
    if (!mainButton.isMounted?.()) return;

    if (mainButton.setParams.isAvailable()) {
      mainButton.setParams({
        text: opts.text,
        isVisible: opts.isVisible ?? true,
        isEnabled: opts.isEnabled ?? true,
        isLoaderVisible: opts.isLoaderVisible ?? false,
        // Default to the brand brass so the native button doesn't inherit
        // Telegram's theme accent (blue/etc.) and clash with the app's
        // charcoal+brass design. Callers can still override per-button.
        backgroundColor: opts.backgroundColor ?? '#C89B3C',
        textColor: opts.textColor ?? '#1A140A',
      });
    }

    const off = mainButton.onClick.isAvailable() ? mainButton.onClick(opts.onClick) : null;
    return () => {
      off?.();
      if (mainButton.setParams.isAvailable()) {
        mainButton.setParams({ isVisible: false, isLoaderVisible: false });
      }
    };
    // We intentionally include the whole opts object in deps so callers can
    // pass inline objects — React shallow-compares its identity, so memoize on
    // the call site if you don't want re-binds on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts?.text,
    opts?.isVisible,
    opts?.isEnabled,
    opts?.isLoaderVisible,
    opts?.backgroundColor,
    opts?.textColor,
    opts?.onClick,
  ]);
}

// ── Native QR scanner ───────────────────────────────────────────────────────

/**
 * Telegram's native camera QR scanner (Mini Apps v6.4+). `scan()` opens the
 * full-screen camera, resolves with the first scanned QR string, and
 * auto-closes; resolves `null` if the user dismisses it or the scanner isn't
 * available (Telegram Desktop without a camera, or running outside Telegram).
 * Callers fall back to manual token entry when `isSupported` is false.
 */
export function useTgQrScanner() {
  return useMemo(
    () => ({
      isSupported(): boolean {
        try {
          return qrScanner.open.isAvailable();
        } catch {
          return false;
        }
      },
      async scan(text: string): Promise<string | null> {
        if (!qrScanner.open.isAvailable()) return null;
        try {
          // `capture: () => true` → grab the first QR and let the SDK close
          // the camera. Returns undefined if the user closed it manually.
          const result = await qrScanner.open({ text, capture: () => true });
          return result ?? null;
        } catch {
          return null;
        }
      },
      close(): void {
        if (qrScanner.close.isAvailable()) qrScanner.close();
      },
    }),
    [],
  );
}

// ── Haptic feedback ────────────────────────────────────────────────────────

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotifyType = 'success' | 'error' | 'warning';

/**
 * Stable haptic helper. Each method is a no-op when not in TG.
 * Returned object is memoised so consumers can safely add it to deps.
 */
export function useTgHaptic() {
  return useMemo(
    () => ({
      tap(style: ImpactStyle = 'light') {
        if (hapticFeedback.impactOccurred?.isAvailable?.()) {
          hapticFeedback.impactOccurred(style);
        }
      },
      select() {
        if (hapticFeedback.selectionChanged?.isAvailable?.()) {
          hapticFeedback.selectionChanged();
        }
      },
      notify(type: NotifyType) {
        if (hapticFeedback.notificationOccurred?.isAvailable?.()) {
          hapticFeedback.notificationOccurred(type);
        }
      },
    }),
    [],
  );
}
