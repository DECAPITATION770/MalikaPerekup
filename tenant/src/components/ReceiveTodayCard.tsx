/**
 * «Сегодня надо получить» — leader card that surfaces the top-3 overdue
 * Nasiya plans with one-tap `tel:` CTAs. Renders nothing when the overdue
 * list is empty so it never pads the page on a clean day.
 *
 * UX_AUDIT.md §retention #1 — without this block the Nasiya feature acts as a
 * passive archive; with it, the dashboard surfaces the single urgent action
 * worth opening the app for. Wires into the same TanStack Query key that the
 * BottomNav badge uses (`['installments', 'overdue-count']` → reused via
 * `['installments', 'overdue-leader']` with limit=3) so the badge count and
 * the card stay in lockstep without double-fetching.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone, PhoneOff } from 'lucide-react';

import { listInstallments, type PlanOut } from '@/api/installments';
import { moneyToNumber } from '@/lib/money';
import { fmtUzsCompact, compactUnits } from '@/lib/fmt';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface Props {
  /** When true, the card is hidden if there are no overdue plans (default).
   *  Pass `false` from /installments to keep the block visible as an empty
   *  state placeholder if needed (currently we still hide on zero). */
  hideOnEmpty?: boolean;
  /** Animation delay (matches Today's staggered fade-up sequence). */
  delay?: number;
  className?: string;
}

const LIMIT = 3;

function remainingUzs(plan: PlanOut): number {
  const total = moneyToNumber(plan.total_amount);
  const paid = moneyToNumber(plan.paid_amount ?? '0');
  return Math.max(0, total - paid);
}

export function ReceiveTodayCard({ hideOnEmpty = true, delay = 0, className }: Props) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const COMPACT = compactUnits(t);

  const { data } = useQuery({
    queryKey: ['installments', 'overdue-leader'],
    queryFn: () => listInstallments({ status: 'overdue', limit: LIMIT, offset: 0 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const total = data?.total ?? 0;
  const top = data?.items ?? [];
  if (hideOnEmpty && total === 0) return null;

  return (
    <section
      className={cn(
        'panel flex animate-fade-up flex-col gap-3 p-4 md:p-5',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
      aria-label={t('today.receive_today_title')}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-subhead font-semibold tracking-[-0.02em]">
          {t('today.receive_today_title')}
        </h2>
        <span className="shrink-0 text-caption tabular-nums text-text-muted">
          {total} {total > LIMIT ? `· топ ${LIMIT}` : ''}
        </span>
      </header>
      <p className="-mt-1.5 text-hint text-text-dim">{t('today.receive_today_body')}</p>

      <ul className="flex flex-col gap-1.5">
        {top.map((plan) => (
          <DebtorRow
            key={plan.id}
            plan={plan}
            remainingLabel={t('today.receive_today_remaining', {
              amount: fmtUzsCompact(remainingUzs(plan), COMPACT),
            })}
            callLabel={t('today.receive_today_call')}
            noPhoneLabel={t('today.receive_today_no_phone')}
            debtorFallback={t('installments.debtor')}
            onCall={() => haptic.tap('medium')}
          />
        ))}
      </ul>

      {total > LIMIT && (
        <Link
          to="/installments?status=overdue"
          onClick={() => haptic.select()}
          className="flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-label font-semibold text-text-dim transition-colors hover:text-text"
        >
          {t('today.receive_today_more', { count: total })}
          <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </section>
  );
}

function DebtorRow({
  plan,
  remainingLabel,
  callLabel,
  noPhoneLabel,
  debtorFallback,
  onCall,
}: {
  plan: PlanOut;
  remainingLabel: string;
  callLabel: string;
  noPhoneLabel: string;
  debtorFallback: string;
  onCall: () => void;
}) {
  const name = plan.buyer_name || debtorFallback;
  const phone = plan.buyer_phone;
  const cleanPhone = phone?.replace(/[^\d+]/g, '');

  return (
    <li className="flex items-center gap-3 rounded-xl bg-bg2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-label font-semibold text-text">{name}</div>
        <div className="text-hint tabular-nums text-text-muted">{remainingLabel}</div>
      </div>
      {cleanPhone ? (
        <a
          href={`tel:${cleanPhone}`}
          onClick={onCall}
          aria-label={`${callLabel}: ${name}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-success px-3 text-caption font-bold text-bg transition-colors hover:opacity-90"
        >
          <Phone size={14} aria-hidden />
          {callLabel}
        </a>
      ) : (
        <span
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-bg3 px-3 text-caption font-semibold text-text-muted"
          aria-label={noPhoneLabel}
        >
          <PhoneOff size={14} aria-hidden />
          {noPhoneLabel}
        </span>
      )}
    </li>
  );
}
