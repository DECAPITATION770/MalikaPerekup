import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { CreditCard, Phone, Send, BadgeDollarSign, Check } from 'lucide-react';
import { listInstallments, makePayment, type PlanOut, type PlanStatus } from '../api/installments';
import { fmtUzs } from '../lib/fmt';
import { fmtMoneyInput, moneyToNumber, parseMoneyInput } from '../lib/money';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

type Filter = PlanStatus | 'all';

const TAB_KEYS: Filter[] = ['active', 'overdue', 'completed', 'all'];

const statusCls: Record<PlanStatus, string> = {
  overdue:   'text-danger bg-danger-faded border-danger/20',
  completed: 'text-success bg-success-faded border-success/20',
  cancelled: 'text-text-muted bg-bg3 border-border',
  active:    'text-accent bg-accent-faded border-accent/20',
};

function PlanCard({ plan }: { plan: PlanOut }) {
  const { t } = useTranslation();
  const hasContact = Boolean(plan.buyer_phone || plan.buyer_tg_username);
  const [payOpen, setPayOpen] = useState(false);
  const canRecord = plan.status === 'active' || plan.status === 'overdue';
  const isOverdue = plan.status === 'overdue';

  // Прогресс по сумме (а не по числу платежей) — это то, что считает перекуп.
  const total = moneyToNumber(plan.total_amount);
  const paid = moneyToNumber(plan.paid_amount ?? '0');
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const paidCount = plan.paid_count ?? 0;
  const paymentsCount = plan.payments_count ?? plan.period_count;

  return (
    <div className={`card p-4 flex flex-col gap-3 ${isOverdue ? 'border-danger/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body-lg font-bold tracking-tight truncate">
            {plan.buyer_name || t('installments.debtor')}
          </div>
          <div className="text-hint text-text-muted mt-0.5">{t('installments.sale_id', { id: plan.sale_id })}</div>
        </div>
        <span className={`shrink-0 text-caption font-bold px-2.5 py-1 rounded-full border ${statusCls[plan.status]}`}>
          {t(`installments.status_${plan.status}`)}
        </span>
      </div>

      {/* Главное число — сколько ещё собрать. Под ним мелким — прогресс. */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-caption text-text-muted uppercase tracking-wider font-semibold">
            {t('installments.remaining')}
          </div>
          <div className="text-caption text-text-muted tabular-nums">
            {paidCount}/{paymentsCount} {t('installments.payments_short')}
          </div>
        </div>
        <div className={`text-title font-bold tabular-nums mt-0.5 ${isOverdue ? 'text-danger' : ''}`}>
          {fmtUzs(remaining)} UZS
        </div>
        <div className="text-caption text-text-muted tabular-nums">
          {t('installments.of_total', { total: `${fmtUzs(total)} UZS` })}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-bg3 overflow-hidden">
          <div
            className={`h-full transition-all ${plan.status === 'completed' ? 'bg-success' : isOverdue ? 'bg-danger' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* One-tap debtor contact — the actionable part for overdue plans */}
      {hasContact ? (
        <div className="flex gap-2">
          {plan.buyer_phone && (
            <a
              href={`tel:${plan.buyer_phone}`}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-bg3 border border-border text-label font-bold hover:border-border-strong active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-accent-faded border border-accent/40 text-accent text-label font-bold hover:bg-accent/20 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Send size={15} />
              {t('installments.write_tg')}
            </a>
          )}
        </div>
      ) : (
        <div className="text-caption text-text-muted text-center py-1">{t('installments.no_contact')}</div>
      )}

      {/* Close the loop: record a real payment received from the debtor */}
      {canRecord && (
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-success-faded border border-success/40 text-success text-label font-bold hover:bg-success/15 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BadgeDollarSign size={16} />
          {t('installments.record_payment')}
        </button>
      )}

      <PaymentModal plan={plan} open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}

function PaymentModal({ plan, open, onClose }: { plan: PlanOut; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const numeric = moneyToNumber(amount);

  const mut = useMutation({
    mutationFn: () => makePayment(plan.id, parseMoneyInput(amount)),
    onSuccess: () => {
      toast.success(t('installments.payment_recorded'));
      qc.invalidateQueries({ queryKey: ['installments'] });
      setAmount('');
      onClose();
    },
    onError: () => toast.error(t('installments.payment_failed')),
  });

  const buyerName = plan.buyer_name || t('installments.debtor');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('installments.record_payment_title', { name: buyerName })}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            full
            disabled={numeric <= 0}
            loading={mut.isPending}
            icon={<Check size={15} />}
            onClick={() => mut.mutate()}
          >
            {t('installments.record_payment')}
          </Button>
        </div>
      }
    >
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
        <p className="text-caption text-text-muted">
          {t('installments.plan_total')}: {fmtUzs(plan.total_amount)} UZS
        </p>
      </div>
    </Modal>
  );
}

export default function Installments() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get('status');
  const filter: Filter = TAB_KEYS.includes(raw as Filter) ? (raw as Filter) : 'active';

  const setFilter = (f: Filter) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      f === 'active' ? next.delete('status') : next.set('status', f);
      return next;
    }, { replace: true });
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['installments', filter],
    queryFn: () => listInstallments({ status: filter === 'all' ? undefined : filter, limit: 50 }),
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: 'active',    label: t('installments.active') },
    { key: 'overdue',   label: t('installments.overdue') },
    { key: 'completed', label: t('installments.completed') },
    { key: 'all',       label: t('installments.all') },
  ];

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-title font-bold tracking-tight">{t('installments.title')}</h1>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`h-9 px-4 rounded-lg border text-label font-semibold transition-all cursor-pointer
              ${filter === tab.key ? 'bg-accent-faded border-accent/40 text-accent' : 'bg-bg2 border-border text-text-dim hover:border-border-strong'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="card h-28 animate-pulse bg-bg2" />)}</div>
      ) : isError ? (
        <div className="card p-4 text-sm text-danger">{t('common.error_load')}</div>
      ) : items.length === 0 ? (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bg3 flex items-center justify-center">
            <CreditCard size={22} className="text-text-muted" />
          </div>
          <p className="font-bold">{t('installments.empty_title')}</p>
          <p className="text-sm text-text-dim max-w-xs leading-relaxed">{t('installments.empty_body')}</p>
          {(filter === 'active' || filter === 'all') && (
            <Link to="/sale/new" className="mt-2">
              <Button size="md" icon={<BadgeDollarSign size={16} />}>{t('today.action_sale')}</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">{items.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</div>
      )}
    </div>
  );
}
