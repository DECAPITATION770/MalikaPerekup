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

// ── Theme bridge: subscribe to themeParams.colorScheme and apply .light class

export function useTgThemeBridge(): 'dark' | 'light' {
  const { inTelegram } = useTelegram();
  const [scheme, setScheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    // Default to system preference when outside Telegram
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    if (!inTelegram) {
      // outside TG, follow system
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      const update = () => setScheme(mql.matches ? 'light' : 'dark');
      update();
      mql.addEventListener?.('change', update);
      return () => mql.removeEventListener?.('change', update);
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
        ...(opts.backgroundColor ? { backgroundColor: opts.backgroundColor } : {}),
        ...(opts.textColor ? { textColor: opts.textColor } : {}),
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
