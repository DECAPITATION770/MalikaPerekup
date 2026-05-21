import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { getDeviceByToken } from '../api/devices';
import Spinner from '../components/ui/Spinner';
import QueryError from '../components/ui/QueryError';

// Lands here when a printed QR sticker is scanned: {WEBAPP}/d/{token}.
// Resolves the token to a device, then forwards to its detail card.
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
        <Spinner />
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
        <QueryError
          status={(q.error as { response?: { status?: number } })?.response?.status}
          onRetry={() => q.refetch()}
        />
      </div>
    );
  }

  return <Navigate to={`/stock/${q.data.id}`} replace />;
}
