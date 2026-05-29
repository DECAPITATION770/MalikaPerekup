/**
 * Theme controls. `ThemeIconButton` is the compact header/sidebar cycler
 * (Auto → Light → Dark); `ThemeSegmented` is the explicit 3-state picker for
 * Settings. Both read/write the shared ThemeProvider.
 */
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';

import { THEME_ORDER, THEME_ICON, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeIconButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { resolved, setPref } = useTheme();
  // Header/sidebar button is a plain light↔dark toggle:
  //   * the icon shows the *applied* colour (Sun in light mode, Moon in
  //     dark mode), so the meaning matches what the user sees, and
  //   * one tap always flips to the opposite — no hidden Auto step that
  //     would otherwise eat a click when the resolved colour happens to
  //     match the underlying preference.
  // The full Auto / Light / Dark picker still lives in Settings.
  const isDark = resolved === 'dark';
  const Icon = isDark ? Moon : Sun;
  const next = isDark ? 'light' : 'dark';
  // Verb-led so screen-readers announce the *action*, not a state that
  // contradicts the visible icon (Sun = «you're in light»). See UX_AUDIT.md.
  const label = t(`settings.theme_switch_to_${next}`);
  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl text-text-dim transition-colors hover:text-text active:bg-bg3',
        className,
      )}
    >
      {/* `key` on the icon span forces a remount when the theme flips, which
          gives us a free fade-in animation on the new glyph instead of an
          instantaneous swap. The global prefers-reduced-motion override in
          index.css clamps the duration to ~0ms for users who opt out. */}
      <span key={isDark ? 'moon' : 'sun'} className="animate-fade-in" aria-hidden>
        <Icon size={20} />
      </span>
    </button>
  );
}

export function ThemeSegmented() {
  const { t } = useTranslation();
  const { pref, setPref } = useTheme();
  return (
    <div className="flex flex-wrap gap-2">
      {THEME_ORDER.map((p) => {
        const Icon = THEME_ICON[p];
        const active = pref === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => setPref(p)}
            className={cn(
              'flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 text-label font-semibold transition-all',
              active
                ? 'border-accent/40 bg-accent-faded text-accent'
                : 'border-border bg-bg2 text-text-dim hover:border-border-strong hover:text-text',
            )}
          >
            <Icon size={15} strokeWidth={1.8} />
            {t(`settings.theme_${p}`)}
          </button>
        );
      })}
    </div>
  );
}
