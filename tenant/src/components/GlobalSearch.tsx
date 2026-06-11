/**
 * GlobalSearch — Cmd+K command palette dialog.
 *
 * Replaces the standalone /search page entry in the sidebar with the
 * pattern users of Linear / Notion / Vercel / GitHub already know:
 * a keyboard-triggered overlay that lets you find devices + people
 * without leaving the current screen. The /search route still exists
 * for deep-link bookmarking, but the primary entry point is now the
 * header button and the ⌘K / Ctrl+K hotkey.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Headphones,
  Laptop,
  Package as PackageIcon,
  Phone,
  Search as SearchIcon,
  Smartphone,
  Tablet,
  User,
  Watch,
  type LucideIcon,
} from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/CounterpartyRoleBadge';
import {
  listDevices,
  type DeviceCategory,
  type DeviceStatus,
} from '@/api/devices';
import { listCounterparties } from '@/api/counterparties';
import { useDebounced } from '@/lib/useDebounced';
import { useTgHaptic } from '@/lib/telegram';

const MIN_CHARS = 2;

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  accessory: Headphones,
  other: PackageIcon,
};

const STATUS_VARIANT: Record<
  DeviceStatus,
  'success' | 'warning' | 'muted' | 'danger' | 'neutral'
> = {
  in_stock: 'success',
  reserved: 'warning',
  sold: 'muted',
  returned: 'danger',
  written_off: 'neutral',
};

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();

  const [input, setInput] = useState('');
  const q = useDebounced(input.trim(), 250);
  const enabled = q.length >= MIN_CHARS;

  // Reset the input every time the palette closes — opening it again
  // should feel like a fresh search, not a continuation. Linear / VSCode
  // / GitHub Cmd+K all behave this way.
  useEffect(() => {
    if (!open) setInput('');
  }, [open]);

  const devicesQ = useQuery({
    queryKey: ['search', 'devices', q],
    queryFn: () => listDevices({ q, limit: 8 }),
    enabled: open && enabled,
    placeholderData: keepPreviousData,
  });
  const cpQ = useQuery({
    queryKey: ['search', 'counterparties', q],
    queryFn: () => listCounterparties({ q, limit: 8 }),
    enabled: open && enabled,
    placeholderData: keepPreviousData,
  });

  const devices = devicesQ.data?.items ?? [];
  const cps = cpQ.data?.items ?? [];
  const loading = enabled && (devicesQ.isLoading || cpQ.isLoading);
  const nothing = enabled && !loading && devices.length === 0 && cps.length === 0;

  const go = (path: string) => {
    haptic.select();
    onOpenChange(false);
    navigate(path);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Lighter scrim — no heavy blur. The palette behaves as a header
            dropdown, not a centered modal, so a strong backdrop reads
            wrong. 30% black is enough to dim chrome without making the
            page feel «hidden behind a window». */}
        <DialogPrimitive.Overlay
          className={
            'fixed inset-0 z-50 bg-black/30 ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          }
        />
        <DialogPrimitive.Content
          // Top-16 (64px below viewport top) lines the palette up under
          // the AppHeader so the dropdown reads as «opened from the
          // search button up there», not «a window floating in the
          // middle of the page». Width capped at max-w-2xl so dense
          // result rows stay scannable on big monitors.
          className={
            'fixed left-1/2 top-16 z-50 w-[92vw] max-w-2xl -translate-x-1/2 ' +
            'rounded-xl border border-border bg-bg2 shadow-2xl outline-none ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
            'data-[state=open]:slide-in-from-top-4 ' +
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 ' +
            'data-[state=closed]:slide-out-to-top-4'
          }
          onOpenAutoFocus={(e) => {
            // Default focus tries the Content; we want the input. Let
            // cmdk's `autoFocus` on CommandInput own it instead.
            e.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {t('search.title')}
          </DialogPrimitive.Title>
          <Command
            shouldFilter={false}
            // Re-apply the cmdk group/input/item type tokens that
            // CommandDialog used to inject. Without these the heading
            // would render unstyled because Command itself is presentation
            // neutral.
            className={
              'overflow-hidden rounded-xl ' +
              '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-bold ' +
              '[&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:text-caption ' +
              '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider ' +
              '[&_[cmdk-input-wrapper]_svg]:size-4 [&_[cmdk-input]]:h-12 ' +
              '[&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5'
            }
          >
            <CommandInput
              autoFocus
              value={input}
              onValueChange={setInput}
              placeholder={t('search.placeholder')}
            />
            <CommandList className="max-h-[60vh]">
        {!enabled && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-bg3">
              <SearchIcon size={22} className="text-text-muted" />
            </div>
            <p className="max-w-xs px-6 text-body leading-relaxed text-text-dim">
              {t('search.hint')}
            </p>
          </div>
        )}

        {nothing && <CommandEmpty>{t('search.empty')}</CommandEmpty>}

        {enabled && devices.length > 0 && (
          <CommandGroup heading={`${t('search.devices')} · ${devices.length}`}>
            {devices.map((d) => {
              const Icon = CATEGORY_ICON[d.category] ?? PackageIcon;
              const photo = d.photos[0];
              return (
                <CommandItem
                  key={`d-${d.id}`}
                  value={`device-${d.id} ${d.brand} ${d.model} ${d.imei ?? ''}`}
                  onSelect={() => go(`/stock/${d.id}`)}
                  className="gap-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg3 text-text-muted ring-1 ring-border">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon size={18} strokeWidth={1.6} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-bold tracking-tight">
                      {d.brand} {d.model}
                    </div>
                    <div className="truncate font-mono text-caption text-text-muted">
                      {d.imei
                        ? `${t('stock.imei')} ${d.imei}`
                        : d.serial
                          ? `${t('stock.serial')} ${d.serial}`
                          : t('stock.no_imei')}
                    </div>
                  </div>
                  <Badge dot variant={STATUS_VARIANT[d.status]} size="sm">
                    {t(`status.${d.status}`)}
                  </Badge>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {enabled && cps.length > 0 && (
          <CommandGroup heading={`${t('search.counterparties')} · ${cps.length}`}>
            {cps.map((cp) => (
              <CommandItem
                key={`c-${cp.id}`}
                value={`cp-${cp.id} ${cp.full_name} ${cp.phone ?? ''}`}
                onSelect={() => go(`/counterparties/${cp.id}`)}
                className="gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg3 text-text-dim ring-1 ring-border">
                  <User size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-body font-bold tracking-tight">
                      {cp.full_name}
                    </span>
                    <RoleBadge type={cp.type} />
                  </div>
                  {cp.phone && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-caption text-text-muted">
                      <Phone size={11} />
                      <span className="font-mono">{cp.phone}</span>
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Note: the ⌘K / Ctrl+K hook used to live here. Removed at partner
// request — global search is now opened only via the explicit triggers
// in Sidebar + AppHeader. Bringing back the hotkey is a 10-line revert
// to the prior version of this file.
