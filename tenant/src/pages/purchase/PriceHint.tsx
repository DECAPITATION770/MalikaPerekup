import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, History, Sparkles } from 'lucide-react';
import { getPriceHint } from '../../api/devices';
import { fmtAmount, moneyToNumber } from '../../lib/money';

interface Props {
  brand: string;
  model: string;
  /** Current price in UZS (already converted from USD if needed). 0 = not entered yet. */
  currentUzs: number;
}

/** Line under the price input on step 4. Shows whether the price the user
 *  is typing is normal for this shop's history of this exact model. */
export default function PriceHint({ brand, model, currentUzs }: Props) {
  const { t } = useTranslation();

  const enabled = brand.trim().length > 0 && model.trim().length > 0;

  const { data, isFetching } = useQuery({
    queryKey: ['devices', 'price-hint', brand.toLowerCase(), model.toLowerCase()],
    queryFn: () => getPriceHint(brand.trim(), model.trim()),
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) return null;
  if (isFetching && !data) return null;

  if (!data || data.count === 0) {
    return (
      <div className="flex items-center gap-2 text-caption text-text-muted px-1">
        <Sparkles size={13} className="text-accent" />
        <span>{t('purchase.price_hint_first')}</span>
      </div>
    );
  }

  const last = moneyToNumber(data.last_price_uzs ?? '');
  const avg = moneyToNumber(data.avg_price_uzs ?? '');

  // Show direction vs the average (a stable baseline; "last" is single-sample noise).
  let delta: { pct: number; dir: 'down' | 'up' | 'flat' } | null = null;
  if (currentUzs > 0 && avg > 0) {
    const pct = ((currentUzs - avg) / avg) * 100;
    const dir = pct < -0.5 ? 'down' : pct > 0.5 ? 'up' : 'flat';
    delta = { pct: Math.abs(pct), dir };
  }

  const DeltaIcon = delta?.dir === 'down' ? TrendingDown : delta?.dir === 'up' ? TrendingUp : null;
  const deltaColor =
    delta?.dir === 'down' ? 'text-success' :
    delta?.dir === 'up' ? 'text-danger' : 'text-text-muted';

  return (
    <div className="flex items-center gap-2 text-caption px-1 flex-wrap">
      <History size={13} className="text-text-muted shrink-0" />
      <span className="text-text-dim">
        {t('purchase.price_hint_history', { count: data.count })}
      </span>
      <span className="text-text-dim tabular-nums font-semibold">
        {t('purchase.price_hint_avg', { amount: fmtAmount(avg) })}
      </span>
      <span className="text-text-muted">·</span>
      <span className="text-text-dim tabular-nums font-semibold">
        {t('purchase.price_hint_last', { amount: fmtAmount(last) })}
      </span>
      {delta && DeltaIcon && (
        <span className={`${deltaColor} font-bold tabular-nums flex items-center gap-0.5 ml-auto`}>
          <DeltaIcon size={13} />
          {delta.pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
