import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client (brief Section 7: optimistic mutations via
 * onMutate / onError rollback). Retry is conservative here because the scanning
 * loop has its own dedicated sync queue with backoff (Section 8); we don't want
 * Query double-retrying the same writes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
