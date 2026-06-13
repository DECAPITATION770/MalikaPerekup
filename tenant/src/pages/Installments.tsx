/**
 * Installments (Nasiya) — list of payment plans grouped by status with
 * one-tap «позвонить» / «написать в TG» / «записать платёж».
 *
 * Phase 3 port: shadcn Tabs for status filter (replaces button-chips),
 * shadcn Dialog for payment recording, shadcn Tooltip showing overdue
 * date, sonner success/error, Tg haptic.notify on payment recorded,
 * Progress component for plan completion.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  Check,
  CheckCheck,
  Copy,
  CloudOff,
  Phone,
  Send,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NoInstallmentsIllustration } from '@/components/illustrations';
import { ReceiveTodayCard } from '@/components/ReceiveTodayCard';

import {
  listInstallments,
  makePayment,
  payoff,
  type PeriodType,
  type PlanOut,
  type PlanStatus,
} from '@/api/installments';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { fmtMoneyInput, moneyToNumber, parseMoneyInput } from '@/lib/money';
import { useTgHaptic } from '@/lib/telegram';
import { enqueuePayment, queueSize } from '@/lib/offlineQueue';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

type Filter = PlanStatus | 'all';

// Overdue leads — this surface exists primarily to chase late payments, so
// the most urgent state earns the first tab. «Активные» stays the visible
// default via the searchParam fallback below so users opening /installments
// with no filter still land on the «работающие» list.
const TAB_KEYS: Filter[] = ['overdue', 'active', 'completed', 'all'];

// «Активна» → success (зелёный), не accent (амбер). На light-теме амбер
// уходит в #8a5c0c (коричневый) ради WCAG, и «Активна» читается как
// плохой статус. Зелёный однозначен, а Прибыль-как-главный-amber на
// странице не конкурирует с status-pill за внимание.
const STATUS_VARIANT: Record<PlanStatus, 'danger' | 'success' | 'muted'> = {
  overdue: 'danger',
  completed: 'success',
  cancelled: 'muted',
  active: 'success',
};

/** Add ``step`` periods to ``start`` — mirrors backend schedule._next_due_date
 *  (monthly clamps day-of-month to the target month's last day). */
function addPeriod(start: Date, type: PeriodType, step: number): Date {
  const d = new Date(start);
  if (type === 'daily') d.setDate(d.getDate() + step);
  else if (type === 'weekly') d.setDate(d.getDate() + step * 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + step);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  return d;
}

/** Next unpaid installment's due date + how many days it's overdue. Replicates
 *  the server schedule (down payment due at start, periodic i due at start+i)
 *  so we can show "overdue N days" / "next payment …" from the list data. */
function nextDueInfo(plan: PlanOut): { nextDue: Date | null; daysOverdue: number } {
  const start = new Date(`${plan.start_date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return { nextDue: null, daysOverdue: 0 };
  const dues: Date[] = [];
  if (moneyToNumber(plan.down_payment) > 0) dues.push(new Date(start));
  for (let i = 1; i <= plan.period_count; i++) dues.push(addPeriod(start, plan.period_type, i));
  const nextDue = dues[plan.paid_count ?? 0] ?? null;
  let daysOverdue = 0;
  if (nextDue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysOverdue = Math.max(0, Math.floor((today.getTime() - nextDue.getTime()) / 86_400_000));
  }
  return { nextDue, daysOverdue };
}

// ── Payment-record dialog ─────────────────────────────────────────────

function PaymentDialog({
  plan,
  open,
  onClose,
}: {
  plan: PlanOut;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const numeric = moneyToNumber(amount);
  const remaining = Math.max(
    0,
    moneyToNumber(plan.total_amount) - moneyToNumber(plan.paid_amount ?? '0'),
  );

  const m = useMutation({
    mutationFn: async () => {
      const value = parseMoneyInput(amount);
      // Offline-first: if there's no connection, queue the payment in
      // IndexedDB and let OfflineSync replay it when we're back online.
      if (!navigator.onLine) {
        await enqueuePayment(plan.id, value);
        return { queued: true as const };
      }
      await makePayment(plan.id, value);
      return { queued: false as const };
    },
    onSuccess: (res) => {
      haptic.notify('success');
      if (res.queued) {
        track('installment_paid_offline', { plan_id: plan.id });
        toast.success(t('installments.payment_queued'));
      } else {
        track('installment_paid', { plan_id: plan.id });
        toast.success(t('installments.payment_recorded'));
        qc.invalidateQueries({ queryKey: ['installments'] });
      }
      setAmount('');
      onClose();
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('installments.payment_failed'));
    },
  });

  const buyerName = plan.buyer_name || t('installments.debtor');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('installments.record_payment_title', { name: buyerName })}</DialogTitle>
          <DialogDescription>
            {t('installments.plan_total')}: {fmtUzs(plan.total_amount)} UZS
          </DialogDescription>
        </DialogHeader>

        {/* Remaining balance — the number the user actually needs while
            entering a payment (was only shown as the «Весь остаток» button
            with no amount). */}
        <div className="flex items-baseline justify-between rounded-card bg-bg2 px-4 py-3">
          <span className="text-label font-medium text-text-dim">
            {t('installments.remaining')}
          </span>
          <span className="text-title-sm font-bold tabular-nums text-accent">
            {fmtUzs(remaining)} UZS
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-label font-medium tracking-tight text-text-dim">
            {t('installments.amount_label')}
          </label>
          <div className="flex h-14 items-center gap-2 rounded-card border border-border bg-bg2 px-4 transition-colors focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
            <input
              autoFocus
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(fmtMoneyInput(e.target.value))}
              className="flex-1 bg-transparent text-title-sm font-bold tabular-nums text-text outline-none placeholder:text-text-muted"
            />
            <span className="text-hint font-bold text-text-muted">UZS</span>
          </div>
          {remaining > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[0.25, 0.5, 0.75].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAmount(fmtMoneyInput(String(Math.round(remaining * f))))}
                  className="h-8 cursor-pointer rounded-lg border border-border bg-bg2 px-3 text-hint font-bold tabular-nums text-text-dim transition-colors hover:border-border-strong hover:text-text"
                >
                  {Math.round(f * 100)}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(fmtMoneyInput(String(Math.round(remaining))))}
                className="h-8 cursor-pointer rounded-lg border border-success/40 bg-success-faded px-3 text-hint font-bold text-success transition-colors hover:bg-success/15"
              >
                {t('installments.pay_full')}
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" full onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button full disabled={numeric <= 0} loading={m.isPending} onClick={() => m.mutate()}>
            <Check className="size-4" />
            {t('installments.record_payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Contact sheet (popover) ───────────────────────────────────────────

/**
 * Compact contact trigger that opens a menu with «Позвонить / TG / Copy».
 *
 * Replaces the old two-button row (Call link + Copy icon). The previous
 * layout broke twice on desktop: tel: was a no-op (browser quirk), and
 * the Copy toast appeared in the top corner — far from the click site,
 * so it read as «nothing happened». A single trigger that always opens
 * a Popover never feels broken, and the inline ✓ feedback on Copy keeps
 * the perceived response under 200 ms.
 */
function ContactSheet({ plan }: { plan: PlanOut }) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const [copied, setCopied] = useState(false);

  const phone = plan.buyer_phone ?? '';
  const tg = plan.buyer_tg_username ?? '';

  const onCopy = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      // Some private-mode browsers block clipboard. Fallback: select + execCommand
      // is also gated nowadays, so the best we can do is surface the number.
    }
    haptic.tap('light');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="focus-ring flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-bg3 px-3.5 text-left transition-all hover:border-border-strong active:scale-[0.99]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Phone size={16} className="shrink-0 text-success" />
            {phone ? (
              <span className="truncate font-mono text-label tabular-nums text-text">
                {phone}
              </span>
            ) : (
              <span className="text-label font-bold text-text">
                @{tg}
              </span>
            )}
          </span>
          <span className="shrink-0 text-hint font-semibold text-text-muted">
            {t('installments.contact')}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <div className="flex flex-col gap-0.5">
          {phone && (
            <>
              {/* tel: works on phones and on Mac (FaceTime / Continuity);
                  on stock desktop Chrome it's a no-op but harmless. */}
              <a
                href={`tel:${phone}`}
                onClick={() => haptic.tap('light')}
                className="focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label font-medium text-text transition-colors hover:bg-bg2"
              >
                <Phone size={15} className="text-success" />
                {t('installments.call')}
              </a>
              <button
                type="button"
                onClick={onCopy}
                className="focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label font-medium text-text transition-colors hover:bg-bg2"
              >
                {copied ? (
                  <>
                    <Check size={15} className="text-success" />
                    <span className="text-success">
                      {t('installments.phone_copied')}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy size={15} className="text-text-dim" />
                    {t('installments.copy_phone')}
                  </>
                )}
              </button>
            </>
          )}
          {tg && (
            <a
              href={`https://t.me/${tg}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic.tap('light')}
              className="focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label font-medium text-text transition-colors hover:bg-bg2"
            >
              <Send size={15} className="text-accent" />
              {t('installments.write_tg')}
              <span className="ml-auto text-hint text-text-muted">@{tg}</span>
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: PlanOut }) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const hasContact = Boolean(plan.buyer_phone || plan.buyer_tg_username);
  const canRecord = plan.status === 'active' || plan.status === 'overdue';
  const isOverdue = plan.status === 'overdue';
  const total = moneyToNumber(plan.total_amount);
  const paid = moneyToNumber(plan.paid_amount ?? '0');
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const paidCount = plan.paid_count ?? 0;
  const paymentsCount = plan.payments_count ?? plan.period_count;
  const { nextDue, daysOverdue } = nextDueInfo(plan);

  const payoffM = useMutation({
    mutationFn: () => payoff(plan.id),
    onSuccess: () => {
      haptic.notify('success');
      toast.success(t('installments.payoff_done'));
      qc.invalidateQueries({ queryKey: ['installments'] });
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('installments.payoff_failed'));
    },
  });

  return (
    <div className={cn('card flex flex-col gap-3 p-4', isOverdue && 'border-danger/30')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {plan.counterparty_id ? (
            <Link
              to={`/counterparties/${plan.counterparty_id}`}
              className="block truncate text-body-lg font-bold tracking-tight transition-colors hover:text-accent"
            >
              {plan.buyer_name || t('installments.debtor')}
            </Link>
          ) : (
            <div className="truncate text-body-lg font-bold tracking-tight">
              {plan.buyer_name || t('installments.debtor')}
            </div>
          )}
          {plan.device_brand || plan.device_model ? (
            <Link
              to={plan.device_id ? `/stock/${plan.device_id}` : '#'}
              className="mt-0.5 block truncate text-hint text-text-muted transition-colors hover:text-text"
            >
              {[plan.device_brand, plan.device_model].filter(Boolean).join(' ')}
            </Link>
          ) : (
            <div className="mt-0.5 text-hint text-text-muted">
              {t('installments.sale_id', { id: plan.sale_id })}
            </div>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[plan.status]}>
          {t(`installments.status_${plan.status}`)}
        </Badge>
      </div>

      {/* Headline number — how much's left to collect */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-caption font-semibold tracking-tight text-text-muted">
            {t('installments.remaining')}
          </div>
          <div className="text-caption tabular-nums text-text-muted">
            {paidCount}/{paymentsCount} {t('installments.payments_short')}
          </div>
        </div>
        <div className={cn('mt-0.5 text-title font-bold tabular-nums', isOverdue && 'text-danger')}>
          {fmtUzs(remaining)} UZS
        </div>
        <div className="text-caption tabular-nums text-text-muted">
          {t('installments.of_total', { total: `${fmtUzs(total)} UZS` })}
        </div>
        {/* Progress fill on light theme is amber #8a5c0c by default — reads
            as a brown stripe instead of progress. Override to success for
            normal flow, keep danger for overdue. Completed already had
            success; active now uses success too so the colour story is
            consistent across the status badge and the bar. */}
        <Progress
          value={pct}
          className={cn(
            'mt-2',
            !isOverdue && '[&>div]:bg-success',
            isOverdue && '[&>div]:bg-danger',
          )}
        />
      </div>

      {/* Due-date line: overdue urgency or the next payment date */}
      {isOverdue && daysOverdue > 0 ? (
        <div className="flex items-center gap-1.5 text-hint font-semibold text-danger">
          <AlertTriangle size={14} />
          {t('installments.overdue_days', { count: daysOverdue })}
          {nextDue && <span className="text-text-muted">· {fmtDate(nextDue.toISOString())}</span>}
        </div>
      ) : (
        canRecord &&
        nextDue && (
          <div className="flex items-center gap-1.5 text-hint text-text-dim">
            <CalendarClock size={14} className="text-text-muted" />
            {t('installments.next_payment', { date: fmtDate(nextDue.toISOString()) })}
          </div>
        )
      )}

      {/* Contact popover — a single button that always opens a menu
          regardless of platform. On mobile «Позвонить» triggers the dialer
          via tel:; on desktop the dialer is no-op (browser quirk, not a
          bug), so the same sheet offers «Скопировать» and «Написать в TG»
          as fallbacks. Showing the actual phone number on the trigger
          itself lets the user dial it manually as a last resort. */}
      {hasContact ? (
        <ContactSheet plan={plan} />
      ) : (
        <div className="py-1 text-center text-caption text-text-muted">
          {t('installments.no_contact')}
        </div>
      )}

      {/* Record payment + early payoff */}
      {canRecord && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-success/40 bg-success-faded text-label font-bold text-success transition-all hover:bg-success/15 active:scale-[0.98]"
          >
            <BadgeDollarSign size={16} />
            {t('installments.record_payment')}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="focus-ring flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 text-hint font-semibold text-text-muted transition-colors hover:text-text"
              >
                <CheckCheck size={15} />
                {t('installments.payoff')}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('installments.payoff_confirm_title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('installments.payoff_confirm_body', { amount: `${fmtUzs(remaining)} UZS` })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => payoffM.mutate()}
                  className="bg-success text-bg hover:bg-success/90"
                >
                  <CheckCheck className="size-4" />
                  {t('installments.payoff')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <PaymentDialog plan={plan} open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function Installments() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get('status');
  const filter: Filter = TAB_KEYS.includes(raw as Filter) ? (raw as Filter) : 'active';

  const setFilter = (f: Filter) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (f === 'active') next.delete('status');
        else next.set('status', f);
        return next;
      },
      { replace: true },
    );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['installments', filter],
    queryFn: () =>
      listInstallments({
        status: filter === 'all' ? undefined : filter,
        limit: 50,
      }),
  });

  const { data: queued = 0 } = useQuery({
    queryKey: ['offline-queue-size'],
    queryFn: queueSize,
    refetchInterval: 5_000,
  });

  // Lightweight count for the «Просроченные» tab badge — shares cache with
  // BottomNav's overdue indicator (same queryKey), so the red dot stays in
  // sync without a duplicate network round-trip.
  const { data: overdueData } = useQuery({
    queryKey: ['installments', 'overdue-count'],
    queryFn: () => listInstallments({ status: 'overdue', limit: 1, offset: 0 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const overdueCount = overdueData?.total ?? 0;

  const items = data?.items ?? [];

  return (
    <div className="flex w-full animate-fade-up flex-col gap-4">
      <h1 className="font-display text-title font-semibold tracking-[-0.03em]">
        {t('installments.title')}
      </h1>

      {queued > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning-faded/40 px-3.5 py-2.5 text-label font-semibold text-warning">
          <CloudOff size={16} />
          {t('installments.queued_pending', { count: queued })}
        </div>
      )}

      {/* Leader: «сегодня надо получить» — same card as on /today, repeated
          here so the user lands on action even if they came straight to the
          archive view via a deep link. Hidden when no overdue. */}
      <ReceiveTodayCard />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="active" className="flex-1">
            {t('installments.active')}
          </TabsTrigger>
          {/* «Просроченные» carries a semantic identity: when active the
              trigger goes danger-tinted; when inactive but the count is
              non-zero, a small red dot signals there's something to look
              at. Both states use existing danger tokens — no new colour. */}
          <TabsTrigger
            value="overdue"
            className="flex-1 gap-1.5 data-[state=active]:!border-danger/40 data-[state=active]:!bg-danger-faded data-[state=active]:!text-danger"
          >
            {t('installments.overdue')}
            {overdueCount > 0 && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            {t('installments.completed')}
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1">
            {t('installments.all')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-4 text-body text-danger">{t('common.error_load')}</div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration={<NoInstallmentsIllustration />}
          title={t('installments.empty_title')}
          description={t('installments.empty_body')}
          action={
            (filter === 'active' || filter === 'all') && (
              <Link to="/sale/new">
                {/* Green to match /sales: buy = orange (money out), sell = green
                    (money in). The default accent CTA here broke that pattern. */}
                <Button variant="success">
                  <BadgeDollarSign className="size-4" />
                  {t('today.action_sale')}
                </Button>
              </Link>
            )
          }
        />
      ) : (
        // Auto-fit grid — columns multiply on wider monitors. PlanCard
        // packs a progress bar + remaining-amount headline + a row of
        // CTAs, so a 360px floor keeps the «Получил оплату» button from
        // crashing into «Закрыть досрочно» on the same line.
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}
        >
          {items.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
