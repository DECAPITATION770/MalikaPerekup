/**
 * Theme controls. `ThemeIconButton` is the compact header/sidebar cycler
 * (Auto → Light → Dark); `ThemeSegmented` is the explicit 3-state picker for
 * Settings. Both read/write the shared ThemeProvider.
 */
import { useTranslation } from 'react-i18next';

import { THEME_ORDER, THEME_ICON, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeIconButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { pref, cycle } = useTheme();
  const Icon = THEME_ICON[pref];
  const label = `${t('settings.theme_label')}: ${t(`settings.theme_${pref}`)}`;
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl text-text-dim transition-colors hover:text-text active:bg-bg3',
        className,
      )}
    >
      <Icon size={20} />
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
