/**
 * PlanExpiryBadge — at-a-glance subscription state from a shop's `plan_until`.
 * Used in the shop detail (always, alongside the date) and the Shops list
 * (`alertsOnly` — only surfaces shops that are expiring/expired so the list
 * draws the eye to problems). Perpetual plans (no date) render nothing.
 */
import { useTranslation } from 'react-i18next';

import { Badge } from './ui/Badge';
import { planUntilStatus } from '../lib/fmt';

interface Props {
  planUntil: string | null | undefined;
  /** Hide the badge when the plan is healthy (>7 days left). */
  alertsOnly?: boolean;
}

export function PlanExpiryBadge({ planUntil, alertsOnly }: Props) {
  const { t } = useTranslation();
  const s = planUntilStatus(planUntil);
  if (!s) return null;
  if (alertsOnly && s.kind === 'ok') return null;

  if (s.kind === 'expired') {
    return (
      <Badge variant="danger" size="sm" dot>
        {t('shop_detail.plan_expired')}
      </Badge>
    );
  }
  if (s.kind === 'soon') {
    return (
      <Badge variant="warning" size="sm" dot>
        {s.days <= 0
          ? t('shop_detail.plan_expires_today')
          : t('shop_detail.plan_days_left', { n: s.days })}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" size="sm">
      {t('shop_detail.plan_days_left', { n: s.days })}
    </Badge>
  );
}

export default PlanExpiryBadge;
