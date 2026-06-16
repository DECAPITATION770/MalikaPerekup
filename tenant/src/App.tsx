/**
 * Root app shell.
 *
 * Phase 3 router: 15 routes wired with `React.lazy` + a single suspense
 * boundary. RequireAuth gates everything behind `/login`. Stub-pages
 * stand in for screens that haven't been ported yet — they share the
 * same AppLayout so users can navigate the rebuilt chrome immediately.
 *
 * Provider tree (outer → inner):
 *   SentryErrorBoundary
 *   PersistQueryClientProvider (TanStack Query + localStorage persistor)
 *   TelegramProvider          (SDK init + themeParams bridge)
 *   TooltipProvider           (Radix)
 *   I18n-aware ErrorBoundary  (catches in-tree render errors with i18n copy)
 *   AuthProvider              (token + user from localStorage, 401 listener)
 *   BrowserRouter
 *   OfflineBanner + SessionExpiredToast + Sonner
 *   Routes (lazy)
 */
import { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OfflineSync } from '@/components/OfflineSync';
import { SessionExpiredToast } from '@/components/SessionExpiredToast';
import { AppLayout } from '@/components/layout/AppLayout';
import { ScrollRestoration } from '@/lib/useScrollRestoration';

import { TelegramProvider } from '@/lib/telegram';
import { ThemeProvider, useTheme } from '@/lib/theme';
import {
  queryClient,
  queryPersister,
  shouldDehydrateQuery,
} from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/store/auth';
import { Sentry } from '@/lib/sentry';

// Routed pages — code-split so cold boot only ships the Today bundle.
const Login = lazy(() => import('@/pages/Login'));
const Today = lazy(() => import('@/pages/Today'));
const Stock = lazy(() => import('@/pages/Stock'));
const StockDetail = lazy(() => import('@/pages/StockDetail'));
const PurchaseNew = lazy(() => import('@/pages/PurchaseNew'));
const SaleNew = lazy(() => import('@/pages/SaleNew'));
const Installments = lazy(() => import('@/pages/Installments'));
const Reports = lazy(() => import('@/pages/Reports'));
const Catalog = lazy(() => import('@/pages/Catalog'));
const Counterparties = lazy(() => import('@/pages/Counterparties'));
const CounterpartyDetail = lazy(() => import('@/pages/CounterpartyDetail'));
const Settings = lazy(() => import('@/pages/Settings'));
const SearchPage = lazy(() => import('@/pages/Search'));
const DeviceByToken = lazy(() => import('@/pages/DeviceByToken'));
const Scan = lazy(() => import('@/pages/Scan'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Sales = lazy(() => import('@/pages/Sales'));

const SentryErrorBoundary = Sentry.ErrorBoundary;

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="size-6 text-accent animate-spin" />
    </div>
  );
}

function RequireAuth() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function ThemedShell() {
  return (
    <ThemeProvider>
      <ScrollRestoration />
      <OfflineBanner />
      <OfflineSync />
      <SessionExpiredToast />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Today />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/stock/:id" element={<StockDetail />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/d/:token" element={<DeviceByToken />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/purchase/new" element={<PurchaseNew />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/sale/new" element={<SaleNew />} />
              <Route path="/installments" element={<Installments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/counterparties" element={<Counterparties />} />
              <Route path="/counterparties/:id" element={<CounterpartyDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ThemedToaster />
    </ThemeProvider>
  );
}

/** Sonner toaster that tracks the resolved theme (Auto/Light/Dark). */
function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      position="top-center"
      closeButton
      theme={resolved}
      // `richColors` painted a near-white slab that clashed with the dark
      // brass theme. Instead colour each toast type from our own tokens so a
      // toast reads like the app's Badges (faded tint + tonal text), in both
      // light and dark. Shape lives on `toast`; colour on the per-type keys so
      // the two never fight over `!important`.
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border !shadow-lg !backdrop-blur',
          title: '!font-semibold',
          description: '!text-text-dim',
          default: '!bg-bg2 !text-text !border-border',
          success: '!bg-success-faded !text-success !border-success/40',
          error: '!bg-danger-faded !text-danger !border-danger/40',
          warning: '!bg-warning-faded !text-warning !border-warning/40',
          actionButton:
            '!bg-accent !text-[rgb(var(--c-on-accent))] !font-semibold !rounded-lg',
          closeButton: '!bg-bg2 !text-text-muted !border-border hover:!text-text',
        },
      }}
    />
  );
}

export function App() {
  return (
    <SentryErrorBoundary
      fallback={
        <div className="p-8 text-center text-danger">Что-то сломалось.</div>
      }
    >
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
              <ErrorBoundary>
                <AuthProvider>
                  <BrowserRouter
                    future={{
                      v7_startTransition: true,
                      v7_relativeSplatPath: true,
                    }}
                  >
                    <ThemedShell />
                  </BrowserRouter>
                </AuthProvider>
              </ErrorBoundary>
            </TooltipProvider>
          </TelegramProvider>
        </QueryClientProvider>
      </PersistQueryClientProvider>
    </SentryErrorBoundary>
  );
}
