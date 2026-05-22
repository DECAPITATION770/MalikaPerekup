import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry on app boot. No-ops in dev (no DSN configured).
 * Configured via env: `VITE_SENTRY_DSN`, `VITE_APP_ENV`, `VITE_APP_VERSION`.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? 'production',
    release: import.meta.env.VITE_APP_VERSION,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    // Don't ship local network errors and aborted fetches to Sentry.
    ignoreErrors: ['Network Error', 'AbortError', 'cancelled'],
  });
}

export { Sentry };
