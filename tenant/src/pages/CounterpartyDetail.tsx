/**
 * CounterpartyDetail — hero card + buy/sell totals + merged chronological
 * deal timeline. Phase 3 port: shadcn Badge + Avatar + Skeleton, haptic
 * on contact taps.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Calendar,
  CalendarClock,
  ChevronRight,
  FileText,
  Pencil,
  Phone,
  Pin,
  PinOff,
  Send,
  ShoppingCart,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import DocumentUploader from '@/components/DocumentUploader';
import { Field, SegmentedRow } from '@/pages/purchase/primitives';
import { DOC_TYPES } from '@/pages/purchase/types';
import {
  getCounterpartyDeals,
  getCounterpartyDocFiles,
  getCounterpartyStats,
  pinCounterparty,
  requestCounterpartyUploadUrl,
  updateCounterparty,
  type CounterpartyOut,
} from '@/api/counterparties';
import { NotesTimeline } from '@/components/NotesTimeline';
import { compactUnits, fmtUzsCompact } from '@/lib/fmt';
import type { PurchaseOut } from '@/api/purchases';
import type { SaleOut } from '@/api/sales';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|svg)$/i;

type DealEvent =
  | { kind: 'purchase'; date: string; ref: PurchaseOut }
  | { kind: 'sale'; date: string; ref: SaleOut };

const TYPE_VARIANT = {
  seller: 'accent',
  buyer: 'success',
  both: 'neutral',
} as const;

export default function CounterpartyDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const q = useQuery({
    queryKey: ['counterparty-deals', Number(id)],
    queryFn: () => getCounterpartyDeals(Number(id!)),
    enabled: Boolean(id),
    retry: false,
  });

  // Server-side stats — replaces the in-memory sum() over deals because the
  // server can JOIN nasiya plans and compute lifetime money without the
  // client refetching every deal.
  const statsQ = useQuery({
    queryKey: ['counterparty-stats', Number(id)],
    queryFn: () => getCounterpartyStats(Number(id!)),
    enabled: Boolean(id),
  });

  const pinM = useMutation({
    mutationFn: (next: boolean) => pinCounterparty(Number(id!), next),
    onSuccess: (updated) => {
      haptic.notify('success');
      // Patch the deals query so the hero re-renders with the new flag —
      // /deals returns the same Counterparty shape so this is a one-field
      // swap, no refetch needed.
      qc.setQueryData(
        ['counterparty-deals', Number(id)],
        (
          prev: ReturnType<typeof getCounterpartyDeals> extends Promise<infer R>
            ? R | undefined
            : never,
        ) => (prev ? { ...prev, counterparty: { ...prev.counterparty, is_pinned: updated.is_pinned } } : prev),
      );
      qc.invalidateQueries({ queryKey: ['counterparties'] });
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('counterparties.pin_failed'));
    },
  });

  const BackLink = (
    <Link
      to="/counterparties"
      className="flex w-fit items-center gap-1.5 text-label font-semibold text-text-dim transition-colors hover:text-text"
    >
      <ArrowLeft size={16} /> {t('counterparties.back')}
    </Link>
  );

  if (q.isLoading) {
    return (
      <div className="flex w-full animate-fade-up flex-col gap-5">
        {BackLink}
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="flex w-full animate-fade-up flex-col gap-5">
        {BackLink}
        <EmptyState
          title={t('common.error_load')}
          action={
            <Button variant="secondary" onClick={() => q.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const { counterparty: cp, purchases, sales } = q.data;

  const events: DealEvent[] = [
    ...purchases.map((p) => ({ kind: 'purchase' as const, date: p.purchase_date, ref: p })),
    ...sales.map((s) => ({ kind: 'sale' as const, date: s.sale_date, ref: s })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const initials =
    cp.full_name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="flex w-full animate-fade-up flex-col gap-5">
      {BackLink}

      {/* Hero */}
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <Avatar className="size-12 rounded-card">
            <AvatarFallback className="rounded-card bg-bg3 text-text-dim">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title font-bold tracking-tight">{cp.full_name}</h1>
              <Badge variant={TYPE_VARIANT[cp.type]} size="sm">
                {t(`counterparties.type_${cp.type}`)}
              </Badge>
            </div>
            {cp.phone && (
              <div className="mt-1 flex items-center gap-1.5 text-label text-text-dim">
                <Phone size={13} />
                <span className="font-mono">{cp.phone}</span>
              </div>
            )}
            {cp.doc_type && cp.doc_number && (
              <div className="mt-1 text-caption text-text-muted">
                {t(`purchase.doc_type.${cp.doc_type}`, { defaultValue: cp.doc_type })}:{' '}
                <span className="font-mono">{cp.doc_number}</span>
              </div>
            )}
            {cp.comment && (
              <p className="mt-2 text-caption leading-relaxed text-text-dim">{cp.comment}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Pin / Unpin — VIP flag that floats the row to the top of
                the directory regardless of debt or activity recency.
                Optimistic UI via the pinM mutation; failure rolls back
                visually by virtue of invalidating the deals query. */}
            <button
              type="button"
              onClick={() => {
                haptic.tap('light');
                pinM.mutate(!cp.is_pinned);
              }}
              disabled={pinM.isPending}
              aria-label={t(cp.is_pinned ? 'counterparties.unpin' : 'counterparties.pin')}
              title={t(cp.is_pinned ? 'counterparties.unpin' : 'counterparties.pin')}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95',
                cp.is_pinned
                  ? 'border-accent/40 bg-accent-faded text-accent hover:bg-accent/15'
                  : 'border-border bg-bg3 text-text-dim hover:border-border-strong hover:text-text',
              )}
            >
              {cp.is_pinned ? <Pin size={15} fill="currentColor" /> : <PinOff size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t('counterparties.edit')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg3 text-text-dim transition-colors hover:border-border-strong hover:text-text"
            >
              <Pencil size={15} />
            </button>
          </div>
        </div>

        {(cp.phone || cp.tg_username) && (
          <div className="flex gap-2">
            {cp.phone && (
              <a
                href={`tel:${cp.phone}`}
                onClick={() => haptic.tap('light')}
                className="focus-ring flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg3 text-label font-bold transition-all hover:border-border-strong active:scale-[0.98]"
              >
                <Phone size={16} className="text-success" />
                {t('installments.call')}
              </a>
            )}
            {cp.tg_username && (
              <a
                href={`https://t.me/${cp.tg_username.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptic.tap('light')}
                className="focus-ring flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-faded text-label font-bold text-accent transition-all hover:bg-accent/20 active:scale-[0.98]"
              >
                <Send size={15} />
                {t('installments.write_tg')}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      {cp.doc_photos.length > 0 && <DocumentsSection id={cp.id} />}

      {/* Stale-contact banner — fires when last_contact_at is older than
          STALE_DAYS days. Soft warning tone, not danger: a 90-day silence
          isn't an error, it's a nudge. Hidden for first-time entries
          (last_contact_at === null) — the whole detail page is already
          a «getting to know» surface in that case. */}
      <StaleContactBanner
        lastContactAt={statsQ.data?.last_contact_at ?? null}
        counterpartyName={cp.full_name}
      />

      {/* Lifetime totals — drives the «brought X, spent Y, owes Z» readout.
          Backed by /counterparties/{id}/stats which joins Sale + Purchase +
          InstallmentPlan in one query — replacing the previous client-side
          sum() that ignored cash-vs-nasiya splits. The third tile shows
          active nasiya count: a buyer with 0 deals but 2 active plans is
          a known-bad-payer worth flagging up here. */}
      {/* `min-w-0` on the grid so each cell can truncate its label
          instead of forcing horizontal overflow on narrow viewports
          («Активные Nasiya» was cut off the right edge of the page
          before this guard). */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={<ShoppingCart size={14} />}
          label={t('purchases.title')}
          n={statsQ.data?.purchases_count ?? purchases.length}
          sum={Number(statsQ.data?.purchases_total_uzs ?? 0)}
          loading={statsQ.isLoading}
        />
        <StatTile
          icon={<BadgeDollarSign size={14} />}
          label={t('sales.title')}
          n={statsQ.data?.sales_count ?? sales.length}
          sum={Number(statsQ.data?.sales_total_uzs ?? 0)}
          loading={statsQ.isLoading}
        />
        <StatTile
          icon={<CalendarClock size={14} />}
          label={t('counterparties.active_nasiya')}
          n={statsQ.data?.active_nasiya_count ?? 0}
          loading={statsQ.isLoading}
          tone={statsQ.data && statsQ.data.active_nasiya_count > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Interaction log — append-only timeline of calls / meetings /
          messages / payments. Always rendered (even with 0 notes) so the
          «add note» button is discoverable. */}
      <NotesTimeline counterpartyId={cp.id} />

      {/* Timeline */}
      {events.length === 0 ? (
        <EmptyState title={t('counterparties.no_deals')} />
      ) : (
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="text-body-lg font-bold tracking-tight">
            {t('counterparties.deals_history')}
          </h2>
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <DealRow key={`${e.kind}-${e.ref.id}`} e={e} />
            ))}
          </ul>
        </div>
      )}

      <EditCounterpartySheet cp={cp} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

/** Document gallery — images render as thumbnails (tap to open full size),
 *  any other file type as a tappable file chip. URLs are signed on demand. */
function DocumentsSection({ id }: { id: number }) {
  const { t } = useTranslation();
  const filesQ = useQuery({
    queryKey: ['counterparty-docs', id],
    queryFn: () => getCounterpartyDocFiles(id),
  });
  const files = filesQ.data ?? [];

  return (
    <div className="card flex flex-col gap-3 p-5">
      <h2 className="text-body-lg font-bold tracking-tight">{t('counterparties.documents')}</h2>
      {filesQ.isLoading ? (
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => {
            const isImage = IMAGE_RE.test(f.name);
            return (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-bg3 transition-colors hover:border-border-strong"
                title={f.name}
              >
                {isImage ? (
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-text-dim">
                    <FileText size={20} />
                    <span className="w-full truncate text-center text-micro leading-tight text-text-muted">
                      {f.name}
                    </span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface EditDraft {
  full_name: string;
  phone: string;
  doc_type: string;
  doc_number: string;
  tg_username: string;
  comment: string;
  doc_photos: string[];
}

function seedDraft(c: CounterpartyOut): EditDraft {
  return {
    full_name: c.full_name,
    phone: c.phone ?? '',
    doc_type: c.doc_type ?? '',
    doc_number: c.doc_number ?? '',
    tg_username: c.tg_username ? `@${c.tg_username.replace(/^@/, '')}` : '',
    comment: c.comment ?? '',
    doc_photos: [...c.doc_photos],
  };
}

function EditCounterpartySheet({
  cp,
  open,
  onClose,
}: {
  cp: CounterpartyOut;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const haptic = useTgHaptic();

  const [draft, setDraft] = useState<EditDraft>(() => seedDraft(cp));
  // Re-seed from the latest counterparty each time the sheet opens.
  useEffect(() => {
    if (open) setDraft(seedDraft(cp));
  }, [open, cp]);

  const mut = useMutation({
    mutationFn: () =>
      updateCounterparty(cp.id, {
        full_name: draft.full_name.trim(),
        phone: draft.phone.trim() || null,
        doc_type: draft.doc_type || null,
        doc_number: draft.doc_number.trim() || null,
        tg_username: draft.tg_username.trim().replace(/^@/, '') || null,
        comment: draft.comment.trim() || null,
        doc_photos: draft.doc_photos,
      }),
    onSuccess: () => {
      haptic.notify('success');
      toast.success(t('counterparties.saved'));
      qc.invalidateQueries({ queryKey: ['counterparty-deals', cp.id] });
      qc.invalidateQueries({ queryKey: ['counterparty-docs', cp.id] });
      qc.invalidateQueries({ queryKey: ['counterparties'] });
      onClose();
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('common.error_load'));
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('counterparties.edit_title')}</SheetTitle>
          <SheetDescription>{cp.full_name}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          <Field label={t('counterparties.name_label')} required>
            <Input
              value={draft.full_name}
              onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
            />
          </Field>
          <Field label={t('counterparties.phone_label')}>
            <Input
              type="tel"
              inputMode="tel"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            />
          </Field>
          <Field label={t('counterparties.tg_label')}>
            <Input
              value={draft.tg_username}
              placeholder="@username"
              onChange={(e) => setDraft((d) => ({ ...d, tg_username: e.target.value }))}
            />
          </Field>
          <Field label={t('counterparties.doc_type_label')}>
            <SegmentedRow
              value={draft.doc_type as (typeof DOC_TYPES)[number] | ''}
              onChange={(v) => setDraft((d) => ({ ...d, doc_type: v }))}
              allowEmpty
              options={DOC_TYPES.map((dt) => ({
                value: dt,
                label: t(`purchase.doc_type.${dt}`),
              }))}
            />
          </Field>
          <Field label={t('counterparties.doc_number_label')}>
            <Input
              value={draft.doc_number}
              onChange={(e) => setDraft((d) => ({ ...d, doc_number: e.target.value }))}
            />
          </Field>
          <Field label={t('counterparties.documents')}>
            <DocumentUploader
              value={draft.doc_photos}
              onChange={(doc_photos) => setDraft((d) => ({ ...d, doc_photos }))}
              requestUploadUrl={requestCounterpartyUploadUrl}
            />
          </Field>
          <Field label={t('counterparties.comment_label')}>
            <Input
              value={draft.comment}
              onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
            />
          </Field>
        </div>

        <SheetFooter>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!draft.full_name.trim() || mut.isPending}
            className="flex-1"
          >
            {t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Stale-contact banner — soft warning when we haven't interacted with a
 * counterparty for STALE_DAYS+ days. Anti-churn surface: shop owners
 * forget about repeat customers after a few months, this nudges them.
 *
 * Threshold of 60 days picked empirically — long enough to skip casual
 * silences (week off, holiday), short enough that a 2-month gap is
 * actually a warning sign for an active relationship.
 */
const STALE_DAYS = 60;

function StaleContactBanner({
  lastContactAt,
  counterpartyName,
}: {
  lastContactAt: string | null;
  counterpartyName: string;
}) {
  const { t } = useTranslation();
  if (!lastContactAt) return null;
  const days = Math.floor(
    (Date.now() - new Date(lastContactAt).getTime()) / 86_400_000,
  );
  if (days < STALE_DAYS) return null;
  return (
    <div
      className="card-elev flex items-start gap-3 border-warning/40 bg-warning-faded/40 p-4"
      role="status"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-faded text-warning"
        aria-hidden
      >
        <AlertTriangle size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-label font-bold text-warning">
          {t('counterparties.stale_title', { count: days })}
        </div>
        <div className="mt-0.5 text-hint text-text-dim">
          {t('counterparties.stale_body', { name: counterpartyName })}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  n,
  sum,
  loading,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  n: number;
  /** Optional money figure under the count. Omit for count-only tiles
   *  (e.g. «активных Nasiya: 1» — money lives in the parent debt strip). */
  sum?: number;
  loading?: boolean;
  /** Visual emphasis for state — `warning` highlights tiles that the user
   *  should look at (e.g. active nasiya > 0 is «watch this person»). */
  tone?: 'neutral' | 'warning';
}) {
  const { t } = useTranslation();
  const units = compactUnits(t);
  return (
    <div
      className={cn(
        // min-w-0 lets the cell shrink inside a constrained grid track —
        // without it, a long label («Активные Nasiya») would force the
        // grid wider than the parent and clip the right edge offscreen.
        'card flex min-w-0 flex-col gap-1 p-4',
        tone === 'warning' && n > 0 && 'border-warning/40',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-2',
          tone === 'warning' && n > 0 ? 'text-warning' : 'text-text-dim',
        )}
      >
        {icon}
        <span className="truncate text-caption font-semibold tracking-tight">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <div className="text-title-sm font-bold tabular-nums">{n}</div>
      )}
      {sum !== undefined && (
        loading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <div className="text-caption tabular-nums text-text-muted">
            {fmtUzsCompact(sum, units)} UZS
          </div>
        )
      )}
    </div>
  );
}

function DealRow({ e }: { e: DealEvent }) {
  const deviceLabel = [e.ref.device_brand, e.ref.device_model].filter(Boolean).join(' ').trim();
  const partyName = e.kind === 'purchase' ? e.ref.seller_name : e.ref.buyer_name;
  const amount = e.kind === 'purchase' ? e.ref.price_uzs : e.ref.sale_price_uzs;
  const Icon = e.kind === 'purchase' ? ShoppingCart : BadgeDollarSign;
  return (
    <li>
      <Link
        to={`/stock/${e.ref.device_id}`}
        className="-mx-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-bg3"
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
            e.kind === 'purchase'
              ? 'bg-accent-faded text-accent ring-accent/30'
              : 'bg-success-faded text-success ring-success/30',
          )}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-label font-semibold tracking-tight">
            {deviceLabel || partyName}
          </div>
          <div className="flex items-center gap-1 text-caption text-text-muted">
            <Calendar size={11} />
            {fmtDate(e.date)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-label font-bold tabular-nums">{fmtUzs(amount)}</div>
          <div className="text-micro text-text-muted">UZS</div>
        </div>
        <ChevronRight size={14} className="shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}
