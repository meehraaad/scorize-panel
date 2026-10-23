import { QueryCache, QueryClient } from '@tanstack/react-query';
import { sessionQuery } from '@/lib/auth/session';
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
      gcTime: 5 * 60_000,
      // Client errors (4xx) will not fix themselves; retry only network and server errors.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
});
