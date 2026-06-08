/**
 * Small inline pill that shows whether a counterparty has acted as a seller,
 * a buyer, or both. Renders nothing for unknown/missing type so the badge
 * gracefully degrades on legacy rows.
 */
import { useTranslation } from 'react-i18next';
import type { CounterpartyType } from '@/api/counterparties';
import { cn } from '@/lib/utils';

const VARIANTS: Record<CounterpartyType, string> = {
  seller: 'border-warning/30 bg-warning/10 text-warning',
  buyer: 'border-info/30 bg-info/10 text-info',
  both: 'border-success/30 bg-success/10 text-success',
};

export default function CounterpartyRoleBadge({
  type,
  className,
}: {
  type: CounterpartyType | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!type) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-caption font-medium leading-none',
        VARIANTS[type],
        className,
      )}
    >
      {t(`counterparties.type_${type}`)}
    </span>
  );
}

export { CounterpartyRoleBadge as RoleBadge };
