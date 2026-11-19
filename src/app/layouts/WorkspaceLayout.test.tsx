import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { delay, http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery, type SessionUser } from '@/lib/auth/session';
import { server } from '@/test/server';
import { WorkspaceLayout } from './WorkspaceLayout';

it('does not cancel the loader-owned session request during a StrictMode frame remount', async () => {
  localStorage.setItem('scorize.mock.session', '1');
  const viewer = await api<SessionUser>('/profile/auth/v1/whoami/');
  server.use(
    http.get('/api/profile/auth/v1/whoami/', async () => {
      await delay(75);
      return HttpResponse.json(viewer);
    }),
  );
  queryClient.clear();
  const pending = queryClient.query(sessionQuery).then(
    (value) => ({ status: 'fulfilled', value }),
    (error: unknown) => ({ status: 'rejected', error }),
  );
  const router = createMemoryRouter([{ path: '/', Component: WorkspaceLayout }]);
  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  expect(await pending).toEqual({ status: 'fulfilled', value: viewer });
  expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(viewer);
});
