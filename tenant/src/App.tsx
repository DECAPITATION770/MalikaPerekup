/**
 * Root app shell.
 *
 * Phase 1 verify-gate stub: renders a centred "Hello shadcn" card via
 * the new shadcn primitives so we can prove the toolchain (Vite SWC +
 * Tailwind 3.4 + Radix + shadcn HSL bridge + PWA + Sentry) wires up end
 * to end before we port the real pages in Phase 3.
 *
 * Wraps Telegram + QueryClient + Sentry providers around the tree so
 * page rewrites can lean on them immediately.
 */
import { Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TelegramProvider, useTgThemeBridge } from '@/lib/telegram';
import { queryClient, queryPersister, shouldDehydrateQuery } from '@/lib/queryClient';
import { Sparkles } from 'lucide-react';
import { Sentry } from '@/lib/sentry';

const SentryErrorBoundary = Sentry.ErrorBoundary;

function HelloShadcn() {
  return (
    <Card className="w-full max-w-md animate-fade-up">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Малика — фундамент готов</CardTitle>
          <Badge variant="accent">
            <Sparkles className="size-3" /> rebuild
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-dim leading-relaxed">
          Phase 1 verify-gate. shadcn/ui + Radix + Vaul + Telegram SDK
          v3 + PWA + Sentry — всё проинициализировано. Можно начинать
          переписывать страницы.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="success">Success</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemedShell() {
  useTgThemeBridge();
  return (
    <main className="min-h-dvh flex items-center justify-center p-4 hero-mesh">
      <Suspense fallback={null}>
        <HelloShadcn />
      </Suspense>
    </main>
  );
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
