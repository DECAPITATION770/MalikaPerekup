/**
 * QR landing: {WEBAPP}/d/{token}. Resolves a printed sticker's token to a
 * device and forwards to its detail card. On failure shows a back link +
 * retry instead of a dead end.
 */
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getDeviceByToken } from '@/api/devices';

export default function DeviceByToken() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();

  const q = useQuery({
    queryKey: ['device-by-token', token],
    queryFn: () => getDeviceByToken(token!),
    enabled: Boolean(token),
    retry: false,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-6 text-accent animate-spin" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="flex flex-col gap-6 animate-fade-up">
        <Link
          to="/stock"
          className="flex items-center gap-1.5 text-text-dim hover:text-text transition-colors text-label font-semibold w-fit"
        >
          <ArrowLeft size={16} /> {t('stock.back')}
        </Link>
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

  return <Navigate to={`/stock/${q.data.id}`} replace />;
}
