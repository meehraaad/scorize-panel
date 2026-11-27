import { QueryCache, QueryClient } from '@tanstack/react-query';
import { sessionQuery } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { ApiError } from './client';

/** A 429 that lifts within 5 s (`Retry-After`). */
const isShortThrottle = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 429 && (error.retryAfter ?? 99) <= 5;

// One session check for a burst of refusals (a page's sections failing together), not one each.
const SESSION_RECHECK_MS = 5000;
let sessionCheckedAt = 0;

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // Any API call refused for auth reasons may mean the session expired. Re-check it: if it is
    // gone, the app shell sees `null` and sends the user to the login page.
    onError: (error, query) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403) &&
        query.queryKey[0] !== sessionQuery.queryKey[0] &&
        Date.now() - sessionCheckedAt > SESSION_RECHECK_MS
      ) {
        sessionCheckedAt = Date.now();
        void queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Pages left open in the cache: going back shows them at once and refreshes behind them.
      gcTime: 30 * 60_000,
      // Client errors (4xx) will not fix themselves; retry only network and server errors, and a
      // rate limit (429) once when Django says it lifts within a few seconds.
      retry: (failureCount, error) => {
        if (isShortThrottle(error)) return failureCount < 1;
        return !(error instanceof ApiError && error.status < 500) && failureCount < 2;
      },
      // The same two retries, sooner: 0.3 s then 0.6 s (the default 1 s then 2 s kept a section
      // on its skeleton for 3 s after one brief server error). A 429 waits what it was told.
      retryDelay: (attempt, error) =>
        isShortThrottle(error)
          ? (error.retryAfter ?? 1) * 1000
          : Math.min(300 * 2 ** attempt, 1500),
      refetchOnWindowFocus: true,
    },
  },
});

// Django words some fields in the request's language (Accept-Language), and the mappers name
// countries and join lists in it: fetch again in the new language.
i18n.on('languageChanged', () => {
  void queryClient.invalidateQueries();
});
