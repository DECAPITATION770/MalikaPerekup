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
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeDollarSign, Check, Phone, Send } from 'lucide-react';

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
import { NoInstallmentsIllustration } from '@/components/illustrations';

import {
  listInstallments,
  makePayment,
  type PlanOut,
  type PlanStatus,
} from '@/api/installments';
import { fmtUzs } from '@/lib/fmt';
import {
  fmtMoneyInput,
  moneyToNumber,
  parseMoneyInput,
} from '@/lib/money';
import { useTgHaptic } from '@/lib/telegram';
import { enqueuePayment } from '@/lib/offlineQueue';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

type Filter = PlanStatus | 'all';

const TAB_KEYS: Filter[] = ['active', 'overdue', 'completed', 'all'];

const STATUS_VARIANT: Record<PlanStatus, 'danger' | 'success' | 'muted' | 'accent'> = {
  overdue: 'danger',
  completed: 'success',
  cancelled: 'muted',
  active: 'accent',
};

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
          <DialogTitle>
            {t('installments.record_payment_title', { name: buyerName })}
          </DialogTitle>
          <DialogDescription>
            {t('installments.plan_total')}: {fmtUzs(plan.total_amount)} UZS
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="text-label text-text-dim font-medium tracking-tight">
            {t('installments.amount_label')}
          </label>
          <div className="flex items-center gap-2 bg-bg2 rounded-2xl border border-border focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 h-14 px-4 transition-colors">
            <input
              autoFocus
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(fmtMoneyInput(e.target.value))}
              className="flex-1 bg-transparent outline-none text-title-sm font-bold text-text placeholder:text-text-muted tabular-nums"
            />
            <span className="text-text-muted text-hint font-bold">UZS</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" full onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            full
            disabled={numeric <= 0}
            loading={m.isPending}
            onClick={() => m.mutate()}
          >
            <Check className="size-4" />
            {t('installments.record_payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: PlanOut }) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const [payOpen, setPayOpen] = useState(false);
  const hasContact = Boolean(plan.buyer_phone || plan.buyer_tg_username);
  const canRecord = plan.status === 'active' || plan.status === 'overdue';
  const isOverdue = plan.status === 'overdue';
  const isComplete = plan.status === 'completed';

  const total = moneyToNumber(plan.total_amount);
  const paid = moneyToNumber(plan.paid_amount ?? '0');
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const paidCount = plan.paid_count ?? 0;
  const paymentsCount = plan.payments_count ?? plan.period_count;

  return (
    <div className={cn('card p-4 flex flex-col gap-3', isOverdue && 'border-danger/30')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body-lg font-bold tracking-tight truncate">
            {plan.buyer_name || t('installments.debtor')}
          </div>
          <div className="text-hint text-text-muted mt-0.5">
            {t('installments.sale_id', { id: plan.sale_id })}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[plan.status]}>
          {t(`installments.status_${plan.status}`)}
        </Badge>
      </div>

      {/* Headline number — how much's left to collect */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-caption text-text-muted uppercase tracking-wider font-semibold">
            {t('installments.remaining')}
          </div>
          <div className="text-caption text-text-muted tabular-nums">
            {paidCount}/{paymentsCount} {t('installments.payments_short')}
          </div>
        </div>
        <div
          className={cn(
            'text-title font-bold tabular-nums mt-0.5',
            isOverdue && 'text-danger',
          )}
        >
          {fmtUzs(remaining)} UZS
        </div>
        <div className="text-caption text-text-muted tabular-nums">
          {t('installments.of_total', { total: `${fmtUzs(total)} UZS` })}
        </div>
        <Progress
          value={pct}
          className={cn(
            'mt-2',
            isComplete && '[&>div]:bg-success',
            isOverdue && '[&>div]:bg-danger',
          )}
        />
      </div>

      {/* One-tap contact */}
      {hasContact ? (
        <div className="flex gap-2">
          {plan.buyer_phone && (
            <a
              href={`tel:${plan.buyer_phone}`}
              onClick={() => haptic.tap('light')}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-bg3 border border-border text-label font-bold hover:border-border-strong active:scale-[0.98] transition-all focus-ring"
            >
              <Phone size={16} className="text-success" />
              {t('installments.call')}
            </a>
          )}
          {plan.buyer_tg_username && (
            <a
              href={`https://t.me/${plan.buyer_tg_username}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic.tap('light')}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-accent-faded border border-accent/40 text-accent text-label font-bold hover:bg-accent/20 active:scale-[0.98] transition-all focus-ring"
            >
              <Send size={15} />
              {t('installments.write_tg')}
            </a>
          )}
        </div>
      ) : (
        <div className="text-caption text-text-muted text-center py-1">
          {t('installments.no_contact')}
        </div>
      )}

      {/* Record payment */}
      {canRecord && (
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-success-faded border border-success/40 text-success text-label font-bold hover:bg-success/15 active:scale-[0.98] transition-all focus-ring"
        >
          <BadgeDollarSign size={16} />
          {t('installments.record_payment')}
        </button>
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

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-title font-bold tracking-tight">{t('installments.title')}</h1>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="active">{t('installments.active')}</TabsTrigger>
          <TabsTrigger value="overdue">{t('installments.overdue')}</TabsTrigger>
          <TabsTrigger value="completed">{t('installments.completed')}</TabsTrigger>
          <TabsTrigger value="all">{t('installments.all')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-4 text-sm text-danger">{t('common.error_load')}</div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration={<NoInstallmentsIllustration />}
          title={t('installments.empty_title')}
          description={t('installments.empty_body')}
          action={
            (filter === 'active' || filter === 'all') && (
              <Link to="/sale/new">
                <Button>
                  <BadgeDollarSign className="size-4" />
                  {t('today.action_sale')}
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
