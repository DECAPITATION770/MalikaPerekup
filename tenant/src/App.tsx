/**
 * Root app shell.
 *
 * Phase 2 — replaces the Phase 1 "Hello shadcn" stub with /dev/showcase
 * as the default route so designers can review every primitive + brand
 * mark + 7 custom icons + 4 illustrations + KpiCard (real useCountUp)
 * in both dark and light theme.
 *
 * Phase 3 will introduce the production router and turn `/dev/showcase`
 * into an actual dev-only path.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TelegramProvider, useTgThemeBridge } from '@/lib/telegram';
import { queryClient, queryPersister, shouldDehydrateQuery } from '@/lib/queryClient';
import { Showcase } from '@/pages/_dev/Showcase';
import { Sentry } from '@/lib/sentry';

const SentryErrorBoundary = Sentry.ErrorBoundary;

function ThemedShell() {
  useTgThemeBridge();
  return <Showcase />;
}

export function App() {
  return (
    <SentryErrorBoundary fallback={<div className="p-8 text-center text-danger">Что-то сломалось.</div>}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: 1000 * 60 * 60 * 24,
          dehydrateOptions: { shouldDehydrateQuery },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <TelegramProvider>
            <TooltipProvider delayDuration={250}>
              <ThemedShell />
              <Toaster
                position="top-center"
                richColors
                closeButton
                theme="dark"
                toastOptions={{ className: 'card !rounded-xl' }}
              />
            </TooltipProvider>
          </TelegramProvider>
        </QueryClientProvider>
      </PersistQueryClientProvider>
    </SentryErrorBoundary>
  );
}
