import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, QrCode, Copy, Check, Smartphone, Tablet, Laptop, Watch, Headphones, Package as PackageIcon, ShoppingCart, BadgeDollarSign, RotateCcw } from 'lucide-react';
import { getDevice, DeviceCategory, DeviceOut } from '../api/devices';
import { getPurchaseByDevice, type PurchaseOut } from '../api/purchases';
import { getSalesByDevice, type SaleOut } from '../api/sales';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtDate, fmtUzs } from '../lib/fmt';
import { formatSpecValue } from '../lib/specsFmt';

const CATEGORY_ICON: Record<DeviceCategory, React.ElementType> = {
  phone: Smartphone, tablet: Tablet, laptop: Laptop, smartwatch: Watch,
  accessory: Headphones, other: PackageIcon,
};

const STATUS_TONE: Record<DeviceOut['status'], 'success' | 'warning' | 'muted' | 'danger' | 'neutral'> = {
  in_stock: 'success', reserved: 'warning', sold: 'muted', returned: 'danger', written_off: 'neutral',
};

const CONDITION_TONE: Record<DeviceOut['condition'], 'success' | 'accent' | 'warning' | 'danger'> = {
  new: 'success', good: 'accent', normal: 'warning', broken: 'danger',
};

export default function StockDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ['device', Number(id)],
    queryFn: () => getDevice(Number(id!)),
    enabled: Boolean(id),
  });

  const copyQr = () => {
    navigator.clipboard.writeText(query.data?.qr_token ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const BackLink = (
    <Link
      to="/stock"
      className="flex items-center gap-1.5 text-text-dim hover:text-text transition-colors text-label font-semibold w-fit"
    >
      <ArrowLeft size={16} /> {t('stock.back')}
    </Link>
  );

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError) return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {BackLink}
      <QueryError
        status={(query.error as { response?: { status?: number } })?.response?.status}
        onRetry={() => query.refetch()}
      />
    </div>
  );

  const d = query.data;
  if (!d) return null;

  const Icon = CATEGORY_ICON[d.category];
  const photo = d.photos[0];
  const specs = Object.entries(d.specs ?? {}).filter(([, v]) => v !== null && v !== '');

  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
      {BackLink}

      {/* Hero card */}
      <div className="card p-5 flex flex-col sm:flex-row gap-5">
        <div className="w-full sm:w-32 h-44 sm:h-32 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon size={40} strokeWidth={1.4} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-title font-bold tracking-tight leading-tight">{d.brand} {d.model}</h1>
          <div className="text-caption text-text-muted font-mono mt-1">
            {d.imei
              ? `${t('stock.imei')} ${d.imei}`
              : d.serial
                ? `${t('stock.serial')} ${d.serial}`
                : t('stock.no_imei')}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <Badge tone={STATUS_TONE[d.status]} size="sm">{t(`status.${d.status}`)}</Badge>
            <Badge tone={CONDITION_TONE[d.condition]} size="sm">{t(`condition.${d.condition}`)}</Badge>
            <Badge tone="neutral" size="sm">{t(`category.${d.category}`)}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 mt-4 text-caption text-text-muted">
            <span>{t('stock.detail_created')}: {fmtDate(d.created_at)}</span>
            {d.updated_at !== d.created_at && (
              <span>{t('stock.detail_updated')}: {fmtDate(d.updated_at)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Specs */}
      {specs.length > 0 && (
        <div className="card p-5 flex flex-col gap-3">
          <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_specs')}</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {specs.map(([key, val]) => (
              <div key={key}>
                <dt className="text-caption text-text-muted">
                  {t(`specs.${key}`, { defaultValue: key.replace(/_/g, ' ') })}
                </dt>
                <dd className="text-label font-semibold text-text mt-0.5 break-words">
                  {formatSpecValue(key, val)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Notes */}
      {d.notes && (
        <div className="card p-5 flex flex-col gap-2">
          <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_notes')}</h2>
          <p className="text-body text-text-dim leading-relaxed">{d.notes}</p>
        </div>
      )}

      <DeviceTimeline deviceId={d.id} />

      {/* QR token */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent-faded flex items-center justify-center shrink-0">
            <QrCode size={20} className="text-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-label font-bold">{t('stock.detail_qr')}</div>
            <div className="text-caption text-text-muted font-mono truncate">{d.qr_token}</div>
          </div>
        </div>
        <button
          onClick={copyQr}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-bg3 text-label font-semibold hover:border-border-strong transition-all cursor-pointer shrink-0"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          {copied ? t('stock.detail_qr_copied') : t('stock.detail_qr_copy')}
        </button>
      </div>
    </div>
  );
}

type TimelineEvent =
  | { kind: 'purchase'; date: string; amount: string; party: string; ref: PurchaseOut }
  | { kind: 'sale';     date: string; amount: string; party: string; ref: SaleOut }
  | { kind: 'return';   date: string; amount: string; party: string; ref: SaleOut };

function DeviceTimeline({ deviceId }: { deviceId: number }) {
  const { t } = useTranslation();
  const purchaseQ = useQuery({
    queryKey: ['purchase-by-device', deviceId],
    queryFn: () => getPurchaseByDevice(deviceId),
    retry: false,
  });
  const salesQ = useQuery({
    queryKey: ['sales-by-device', deviceId],
    queryFn: () => getSalesByDevice(deviceId),
  });

  const events: TimelineEvent[] = [];
  if (purchaseQ.data) {
    events.push({
      kind: 'purchase',
      date: purchaseQ.data.purchase_date,
      amount: purchaseQ.data.price_uzs,
      party: purchaseQ.data.seller_name,
      ref: purchaseQ.data,
    });
  }
  for (const s of salesQ.data ?? []) {
    events.push({
      kind: 'sale',
      date: s.sale_date,
      amount: s.sale_price_uzs,
      party: s.buyer_name,
      ref: s,
    });
    if (s.status === 'returned' && s.returned_at) {
      events.push({
        kind: 'return',
        date: s.returned_at.slice(0, 10),
        amount: s.sale_price_uzs,
        party: s.buyer_name,
        ref: s,
      });
    }
  }
  // Sort ascending by date; ties keep purchase-first (it's the genesis event).
  const KIND_ORDER = { purchase: 0, sale: 1, return: 2 };
  events.sort((a, b) =>
    a.date === b.date ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.date.localeCompare(b.date),
  );

  if (purchaseQ.isLoading || salesQ.isLoading) {
    return (
      <div className="card p-5 flex flex-col gap-3">
        <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_history')}</h2>
        <Skeleton w="100%" h={48} />
      </div>
    );
  }
  if (events.length === 0) return null;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_history')}</h2>
      <ol className="flex flex-col gap-3">
        {events.map((e, i) => <TimelineRow key={i} e={e} />)}
      </ol>
    </div>
  );
}

function TimelineRow({ e }: { e: TimelineEvent }) {
  const { t } = useTranslation();
  const cfg = {
    purchase: { Icon: ShoppingCart,     tone: 'text-accent bg-accent-faded ring-accent/30',  label: t('stock.event_purchase') },
    sale:     { Icon: BadgeDollarSign,  tone: 'text-success bg-success-faded ring-success/30', label: t('stock.event_sale') },
    return:   { Icon: RotateCcw,        tone: 'text-danger bg-danger-faded ring-danger/30',  label: t('stock.event_return') },
  }[e.kind];
  const { Icon } = cfg;
  return (
    <li className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 shrink-0 ${cfg.tone}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-label font-semibold tracking-tight truncate">
          {cfg.label} · <span className="text-text-dim font-normal">{e.party}</span>
        </div>
        <div className="text-caption text-text-muted">{fmtDate(e.date)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-label font-bold tabular-nums">{fmtUzs(e.amount)}</div>
        <div className="text-micro text-text-muted">UZS</div>
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
      <Skeleton w={80} h={16} />
      <div className="card p-5 flex gap-5">
        <Skeleton w={128} h={128} rounded="xl" />
        <div className="flex-1 flex flex-col gap-3 pt-1">
          <Skeleton w="65%" h={22} />
          <Skeleton w="40%" h={13} />
          <div className="flex gap-2 mt-1">
            <Skeleton w={64} h={20} rounded="full" />
            <Skeleton w={52} h={20} rounded="full" />
          </div>
        </div>
      </div>
    </div>
  );
}
