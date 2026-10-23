import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Suspense } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { queryClient } from '@/lib/api/queryClient';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';

/** Renders the real app (all routes, loaders and layouts) at `path`, against the MSW fake Django. */
export function renderApp(path: string) {
  queryClient.clear();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Suspense>
          <RouterProvider router={router} />
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return router;
}
