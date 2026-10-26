import { QueryCache, QueryClient } from '@tanstack/react-query';
import { sessionQuery } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { ApiError } from './client';

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // Any API call refused for auth reasons may mean the session expired. Re-check it: if it is
    // gone, the app shell sees `null` and sends the user to the login page.
    onError: (error, query) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403) &&
        query.queryKey[0] !== sessionQuery.queryKey[0]
      ) {
        void queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Pages left open in the cache: going back shows them at once and refreshes behind them.
      gcTime: 30 * 60_000,
      // Client errors (4xx) will not fix themselves; retry only network and server errors.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
});

// Django words some fields in the request's language (Accept-Language), and the mappers name
// countries and join lists in it: fetch again in the new language.
i18n.on('languageChanged', () => {
  void queryClient.invalidateQueries();
});
