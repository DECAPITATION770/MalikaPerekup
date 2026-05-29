/**
 * Search — global lookup over devices + counterparties. Phase 3 port to
 * cmdk: an inline Command palette (shouldFilter=false — results come from
 * the API, not local filtering) with two groups and keyboard nav. One-tap
 * actions preserved for counterparties.
 */
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Headphones,
  Laptop,
  Package as PackageIcon,
  Phone,
  Search as SearchIcon,
  Send,
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
import { listDevices, type DeviceCategory, type DeviceStatus } from '@/api/devices';
import { listCounterparties, type CounterpartyType } from '@/api/counterparties';
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

const CP_VARIANT: Record<CounterpartyType, 'accent' | 'success' | 'neutral'> = {
  seller: 'accent',
  buyer: 'success',
  both: 'neutral',
};

export default function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const q = useDebounced(input.trim(), 300);
  const enabled = q.length >= MIN_CHARS;

  const onChange = (val: string) => {
    setInput(val);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val.trim()) next.set('q', val.trim());
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  };

  const devicesQ = useQuery({
    queryKey: ['search', 'devices', q],
    queryFn: () => listDevices({ q, limit: 8 }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const cpQ = useQuery({
    queryKey: ['search', 'counterparties', q],
    queryFn: () => listCounterparties({ q, limit: 8 }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const devices = devicesQ.data?.items ?? [];
  const cps = cpQ.data?.items ?? [];
  const loading = enabled && (devicesQ.isLoading || cpQ.isLoading);
  const nothing = enabled && !loading && devices.length === 0 && cps.length === 0;

  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
      <h1 className="text-title font-bold tracking-tight">{t('search.title')}</h1>

      <Command shouldFilter={false} className="card border-border">
        <CommandInput
          autoFocus
          value={input}
          onValueChange={onChange}
          placeholder={t('search.placeholder')}
        />
        <CommandList className="max-h-[60vh]">
          {!enabled && (
            <div className="py-10 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-card bg-bg3 flex items-center justify-center">
                <SearchIcon size={22} className="text-text-muted" />
              </div>
              <p className="text-body text-text-dim max-w-xs leading-relaxed px-6">
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
                    value={`device-${d.id}`}
                    onSelect={() => {
                      haptic.select();
                      navigate(`/stock/${d.id}`);
                    }}
                    className="gap-3"
                  >
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
                      {photo ? (
                        <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Icon size={18} strokeWidth={1.6} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-body font-bold tracking-tight truncate">
                        {d.brand} {d.model}
                      </div>
                      <div className="text-caption text-text-muted font-mono truncate">
                        {d.imei
                          ? `${t('stock.imei')} ${d.imei}`
                          : d.serial
                            ? `${t('stock.serial')} ${d.serial}`
                            : t('stock.no_imei')}
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[d.status]} size="sm">
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
                  value={`cp-${cp.id}`}
                  onSelect={() => {
                    haptic.select();
                    navigate(`/counterparties/${cp.id}`);
                  }}
                  className="gap-3"
                >
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-bg3 ring-1 ring-border flex items-center justify-center text-text-dim">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-bold tracking-tight truncate">
                        {cp.full_name}
                      </span>
                      <Badge variant={CP_VARIANT[cp.type]} size="sm">
                        {t(`counterparties.type_${cp.type}`)}
                      </Badge>
                    </div>
                    {cp.phone && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-caption text-text-muted">
                        <Phone size={11} />
                        <span className="font-mono">{cp.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {cp.phone && (
                      <a
                        href={`tel:${cp.phone}`}
                        aria-label={t('installments.call')}
                        onClick={(e) => {
                          e.stopPropagation();
                          haptic.tap('light');
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-bg3 border border-border text-success hover:border-border-strong active:scale-95 transition-all"
                      >
                        <Phone size={15} />
                      </a>
                    )}
                    {cp.tg_username && (
                      <a
                        href={`https://t.me/${cp.tg_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('installments.write_tg')}
                        onClick={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent-faded border border-accent/40 text-accent hover:bg-accent/20 active:scale-95 transition-all"
                      >
                        <Send size={14} />
                      </a>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
