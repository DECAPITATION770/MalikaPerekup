import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './store/auth';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import SessionExpiredToast from './components/SessionExpiredToast';
import OfflineBanner from './components/OfflineBanner';
import AppLayout from './components/layout/AppLayout';
import Spinner from './components/ui/Spinner';

const Login         = lazy(() => import('./pages/Login'));
const Today         = lazy(() => import('./pages/Today'));
const Stock         = lazy(() => import('./pages/Stock'));
const PurchaseNew   = lazy(() => import('./pages/PurchaseNew'));
const SaleNew       = lazy(() => import('./pages/SaleNew'));
const Installments  = lazy(() => import('./pages/Installments'));
const Reports       = lazy(() => import('./pages/Reports'));
const Counterparties= lazy(() => import('./pages/Counterparties'));
const Settings      = lazy(() => import('./pages/Settings'));
const StockDetail   = lazy(() => import('./pages/StockDetail'));
const SearchPage    = lazy(() => import('./pages/Search'));
const DeviceByToken = lazy(() => import('./pages/DeviceByToken'));
const Purchases    = lazy(() => import('./pages/Purchases'));
const Sales        = lazy(() => import('./pages/Sales'));
const CounterpartyDetail = lazy(() => import('./pages/CounterpartyDetail'));

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      refetchOnReconnect: true,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Spinner />
    </div>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <SessionExpiredToast />
            <OfflineBanner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                    <Route path="/"               element={<Today />} />
                    <Route path="/stock"          element={<Stock />} />
                    <Route path="/stock/:id"     element={<StockDetail />} />
                    <Route path="/search"        element={<SearchPage />} />
                    <Route path="/d/:token"      element={<DeviceByToken />} />
                    <Route path="/purchases"     element={<Purchases />} />
                    <Route path="/purchase/new"   element={<PurchaseNew />} />
                    <Route path="/sales"         element={<Sales />} />
                    <Route path="/sale/new"       element={<SaleNew />} />
                    <Route path="/installments"   element={<Installments />} />
                    <Route path="/reports"        element={<Reports />} />
                    <Route path="/counterparties" element={<Counterparties />} />
                    <Route path="/counterparties/:id" element={<CounterpartyDetail />} />
                    <Route path="/settings"       element={<Settings />} />
                    <Route path="*"               element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
