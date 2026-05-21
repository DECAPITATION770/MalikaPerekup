import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search as SearchIcon, X, ChevronRight, User, Phone, Send,
  Smartphone, Tablet, Laptop, Watch, Headphones, Package as PackageIcon,
  type LucideIcon,
} from 'lucide-react';
import { listDevices, type DeviceCategory, type DeviceStatus, type DeviceOut } from '../api/devices';
import { listCounterparties, type CounterpartyOut, type CounterpartyType } from '../api/counterparties';
import { useDebounced } from '../lib/useDebounced';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';

const MIN_CHARS = 2;

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone, tablet: Tablet, laptop: Laptop, smartwatch: Watch,
  accessory: Headphones, other: PackageIcon,
};

const STATUS_TONE: Record<DeviceStatus, 'success' | 'warning' | 'muted' | 'danger' | 'neutral'> = {
  in_stock: 'success', reserved: 'warning', sold: 'muted', returned: 'danger', written_off: 'neutral',
};

const CP_TONE: Record<CounterpartyType, 'accent' | 'success' | 'neutral'> = {
  seller: 'accent', buyer: 'success', both: 'neutral',
};

function DeviceHit({ d }: { d: DeviceOut }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[d.category] ?? PackageIcon;
  const photo = d.photos[0];
  return (
    <li className="card hover:border-border-strong transition-all">
      <Link to={`/stock/${d.id}`} className="p-3 flex items-center gap-3 block rounded-2xl">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Icon size={20} strokeWidth={1.6} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-bold tracking-tight truncate">{d.brand} {d.model}</h3>
          <div className="text-caption text-text-muted font-mono truncate">
            {d.imei ? `${t('stock.imei')} ${d.imei}` : d.serial ? `${t('stock.serial')} ${d.serial}` : t('stock.no_imei')}
          </div>
        </div>
        <Badge tone={STATUS_TONE[d.status]} size="sm">{t(`status.${d.status}`)}</Badge>
        <ChevronRight size={16} className="text-text-muted shrink-0" />
      </Link>
    </li>
  );
}

function CounterpartyHit({ cp }: { cp: CounterpartyOut }) {
  const { t } = useTranslation();
  return (
    <li className="card p-3 flex items-center gap-3">
      <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-dim">
        <User size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body font-bold tracking-tight truncate">{cp.full_name}</span>
          <Badge tone={CP_TONE[cp.type]} size="sm">{t(`counterparties.type_${cp.type}`)}</Badge>
        </div>
        {cp.phone && (
          <div className="flex items-center gap-1.5 mt-0.5 text-caption text-text-muted">
            <Phone size={11} /><span className="font-mono">{cp.phone}</span>
          </div>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {cp.phone && (
          <a
            href={`tel:${cp.phone}`}
            aria-label={t('installments.call')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-bg3 border border-border text-success hover:border-border-strong active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Phone size={16} />
          </a>
        )}
        {cp.tg_username && (
          <a
            href={`https://t.me/${cp.tg_username}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('installments.write_tg')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-faded border border-accent/40 text-accent hover:bg-accent/20 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Send size={15} />
          </a>
        )}
      </div>
    </li>
  );
}

function GroupSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <li key={i} className="card p-3 flex items-center gap-3">
          <Skeleton w={44} h={44} rounded="xl" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton w="55%" h={14} />
            <Skeleton w="35%" h={11} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Search() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const q = useDebounced(input.trim(), 300);
  const enabled = q.length >= MIN_CHARS;

  const onChange = (val: string) => {
    setInput(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      val.trim() ? next.set('q', val.trim()) : next.delete('q');
      return next;
    }, { replace: true });
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

      <div className="flex items-center gap-2 bg-bg2 rounded-xl border border-border focus-within:border-accent transition-colors h-12 px-3.5">
        <SearchIcon size={16} className="text-text-muted shrink-0" />
        <input
          autoFocus
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('search.placeholder')}
          className="flex-1 bg-transparent outline-none text-body placeholder:text-text-muted"
          spellCheck={false}
        />
        {input && (
          <button
            onClick={() => onChange('')}
            aria-label={t('common.close')}
            className="text-text-muted hover:text-text transition-colors p-0.5 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!enabled && (
        <div className="card p-8 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-bg3 flex items-center justify-center">
            <SearchIcon size={22} className="text-text-muted" />
          </div>
          <p className="text-sm text-text-dim max-w-xs leading-relaxed">{t('search.hint')}</p>
        </div>
      )}

      {nothing && (
        <div className="card p-8 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-bg3 flex items-center justify-center">
            <SearchIcon size={22} className="text-text-muted" />
          </div>
          <p className="font-bold">{t('search.empty')}</p>
        </div>
      )}

      {enabled && (devices.length > 0 || loading) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label font-bold text-text-dim uppercase tracking-wider">
            {t('search.devices')}{devices.length > 0 && ` · ${devices.length}`}
          </h2>
          {loading && devices.length === 0 ? (
            <GroupSkeleton />
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {devices.map((d) => <DeviceHit key={d.id} d={d} />)}
            </ul>
          )}
        </section>
      )}

      {enabled && (cps.length > 0 || loading) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label font-bold text-text-dim uppercase tracking-wider">
            {t('search.counterparties')}{cps.length > 0 && ` · ${cps.length}`}
          </h2>
          {loading && cps.length === 0 ? (
            <GroupSkeleton />
          ) : (
            <ul className="flex flex-col gap-2">
              {cps.map((cp) => <CounterpartyHit key={cp.id} cp={cp} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
