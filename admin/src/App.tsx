import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider } from './store/auth';
import { ThemeProvider, useTheme } from './lib/theme';
import ErrorBoundary from './components/ErrorBoundary';
import SessionExpiredToast from './components/SessionExpiredToast';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Shops from './pages/Shops';
import ShopDetail from './pages/ShopDetail';
import CreateShop from './pages/CreateShop';
import AuthLog from './pages/AuthLog';
import Debts from './pages/Debts';
import Stats from './pages/Stats';
import Users from './pages/Users';
import Backup from './pages/Backup';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry 4xx — they're terminal. Retry network/5xx up to 2 times with backoff.
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

/** Sonner Toaster styled to follow the current theme. */
function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-right"
      closeButton
      duration={3500}
      // `richColors` painted a near-white slab that clashed with the dark
      // brass theme. Colour each toast type from our own tokens instead (same
      // treatment as the tenant app) so toasts read like the app's Badges.
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border !shadow-lg !backdrop-blur',
          title: '!font-semibold',
          description: '!text-text-dim',
          default: '!bg-bg2 !text-text !border-border',
          success: '!bg-success-faded !text-success !border-success/40',
          error: '!bg-danger-faded !text-danger !border-danger/40',
          warning: '!bg-warning-faded !text-warning !border-warning/40',
          actionButton: '!bg-accent !text-accent-fg !font-semibold !rounded-lg',
          closeButton: '!bg-bg2 !text-text-muted !border-border hover:!text-text',
        },
      }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <AuthProvider>
            <ThemedToaster />
            <SessionExpiredToast />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<AppLayout />}>
                  <Route path="/"          element={<Dashboard />} />
                  <Route path="/shops"     element={<Shops />} />
                  <Route path="/shops/:id" element={<ShopDetail />} />
                  <Route path="/create"    element={<CreateShop />} />
                  <Route path="/users"     element={<Users />} />
                  <Route path="/log"       element={<AuthLog />} />
                  <Route path="/debts"     element={<Debts />} />
                  <Route path="/stats"     element={<Stats />} />
                  <Route path="/backup"    element={<Backup />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
