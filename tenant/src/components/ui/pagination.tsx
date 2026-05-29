import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/**
 * Minimal offset-based pagination used by list pages (Stock, Purchases,
 * Sales). Renders nothing for a single page.
 */
export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-body">
      <span className="text-text-dim tabular-nums">
        {t('common.page_n_of_m', { current: currentPage, total: totalPages })}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          {t('common.prev')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
