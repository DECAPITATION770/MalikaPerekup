import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sentry } from '@/lib/sentry';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

class _Inner extends Component<{ children: ReactNode; fallback: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    Sentry.withScope((scope) => {
      if (info.componentStack) scope.setExtra('componentStack', info.componentStack);
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * App-level error boundary. On render crash, captures to Sentry and shows
 * an i18n-translated recovery card with a single reload button.
 *
 * Fixes the legacy ErrorBoundary's hardcoded Russian strings (audit gap).
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return <_Inner fallback={<FallbackUI />}>{children}</_Inner>;
}

function FallbackUI() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-bg">
      <div className="card p-8 max-w-md text-center space-y-4">
        <h1 className="text-subhead font-bold text-text">{t('errors.boundary_title')}</h1>
        <p className="text-sm text-text-dim leading-relaxed">{t('errors.boundary_body')}</p>
        <Button onClick={() => window.location.reload()} full>
          {t('errors.boundary_reload')}
        </Button>
      </div>
    </div>
  );
}
