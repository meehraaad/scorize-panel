import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import type { CustomerInfo, InfoSection } from './info';
import { useSaveInfo } from './infoMutations';

const info: CustomerInfo = {
  personal: {
    first_name: 'A',
    last_name: 'B',
    father_name: '',
    birth_date: '',
    gender: '',
    marital: '',
    military: '',
    city: '',
    work_years: '0',
  },
  goal: { wanted_degree: '', budget: '', countries: '', language: '' },
  education: [],
  exams: [],
  exams_list: [],
  tablet_url: '',
  tablet_share_url: '',
};

function setup() {
  const client = new QueryClient();
  client.setQueryData(['sales', 'customer', 105, 'info'], info);
  for (const key of [
    ['sales', 'customer', 105],
    ['sales', 'leads', {}],
    ['sales', 'board', 0],
  ])
    client.setQueryData(key, {});
  server.use(
    http.patch('/api/sales/v1/customers/105/info/', async ({ request }) => {
      const body = (await request.json()) as InfoSection;
      return HttpResponse.json({ ...info, ...body });
    }),
  );
  const { result } = renderHook(() => useSaveInfo(105), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const stale = () =>
    client
      .getQueryCache()
      .getAll()
      .filter((query) => query.isStale() && query.state.isInvalidated)
      .map((query) => query.queryKey[1]);
  return { client, result, stale };
}

describe('saving customer info', () => {
  it('a new name refreshes every sales view that shows it, not the editor', async () => {
    const { result, stale } = setup();
    await act(() =>
      result.current.mutateAsync({ personal: { ...info.personal, first_name: 'Sara' } }),
    );
    expect(stale().sort()).toEqual(['board', 'customer', 'leads']);
  });

  it('other fields refresh only the customer header', async () => {
    const { result, client } = setup();
    await act(() => result.current.mutateAsync({ personal: { ...info.personal, city: 'Tehran' } }));
    const invalid = client
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.isInvalidated)
      .map((query) => query.queryKey);
    expect(invalid).toEqual([['sales', 'customer', 105]]);
  });
});
