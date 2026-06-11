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
      richColors
      closeButton
      duration={3500}
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
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
