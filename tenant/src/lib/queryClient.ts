import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * App-wide TanStack Query client.
 *
 * - `staleTime: 30s` — keep data warm during quick page-to-page nav.
 * - `gcTime: 24h` — extended so the localStorage persister has meaningful
 *   cached entries to restore on cold boot.
 * - Retries are exponential with a small cap so flaky 4G doesn't spin forever.
 * - Mutations: no retry by default (idempotency varies by endpoint).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (count, err) => {
        // Don't retry 4xx (client errors) — they're not transient.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return count < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

/**
 * Persist non-mutation queries to localStorage so the UI loads instantly on
 * cold boot (especially important when offline on the market floor).
 *
 * Only meaningful queries are persisted — see `shouldDehydrateQuery`.
 */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'malika-query-cache-v1',
  throttleTime: 1000,
});

const PERSISTABLE_KEYS = new Set(['reports', 'shops', 'devices', 'installments', 'counterparties']);

/** localStorage key the query persister writes to (referenced on logout). */
export const QUERY_CACHE_KEY = 'malika-query-cache-v1';

/** Persistor option: which queries to dehydrate.
 *
 * MUST keep TanStack's default guard (`status === 'success'`) — without it,
 * in-flight (pending) queries get persisted and then *resumed* on the next cold
 * boot, even on the unauthenticated `/login` route, firing a storm of 401s. We
 * only add a key allowlist on top of that default. */
export function shouldDehydrateQuery(query: Parameters<typeof defaultShouldDehydrateQuery>[0]): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  const root = query.queryKey?.[0];
  return typeof root === 'string' && PERSISTABLE_KEYS.has(root);
}
