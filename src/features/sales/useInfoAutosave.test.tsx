import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import type { CustomerInfo, InfoSection } from './api';
import { useInfoAutosave } from './useInfoAutosave';

const ENDPOINT = '/api/sales/v1/customers/105/info/';
const initial: CustomerInfo = {
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
};

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let router: ReturnType<typeof createMemoryRouter>;
  const hook = renderHook(() => useInfoAutosave(105, initial), {
    wrapper: ({ children }: { children: ReactNode }) => {
      router = createMemoryRouter([{ path: '*', element: children }], {
        initialEntries: ['/info'],
      });
      return (
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      );
    },
  });
  return {
    ...hook,
    navigate: (path: string) => router.navigate(path),
    location: () => router.state.location.pathname,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('customer info autosave', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });
  it('does not write on mount; keeps newer edits while serializing slow section saves', async () => {
    const requests: InfoSection[] = [];
    const held = deferred();
    server.use(
      http.patch(ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as InfoSection;
        requests.push(body);
        if (requests.length === 1) await held.promise;
        return HttpResponse.json({ ...initial, ...body });
      }),
    );
    const { result } = setup();
    expect(requests).toHaveLength(0);
    act(() => {
      result.current.update('personal', { ...initial.personal, city: 'First' });
    });
    let saving!: Promise<boolean>;
    act(() => {
      saving = result.current.flush();
    });
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => {
      result.current.update('personal', { ...initial.personal, city: 'Newest' });
      result.current.update('goal', { ...initial.goal, language: 'B2' });
    });
    expect(requests).toHaveLength(1);
    await act(async () => {
      held.resolve();
      await saving;
    });
    expect(requests.map((body) => body.personal?.city ?? body.goal?.language)).toEqual([
      'First',
      'Newest',
      'B2',
    ]);
    expect(result.current.draft.personal.city).toBe('Newest');
    expect(result.current.statuses.personal).toBe('saved');
    expect(result.current.statuses.goal).toBe('saved');
  });

  it('keeps failed input, prevents unload, and retries without repeated requests', async () => {
    onlineManager.setOnline(false);
    let calls = 0;
    server.use(
      http.patch(ENDPOINT, async ({ request }) => {
        calls++;
        const body = (await request.json()) as InfoSection;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ ...initial, ...body });
      }),
    );
    const { result } = setup();
    act(() => {
      result.current.update('personal', { ...initial.personal, city: 'Tehran' });
    });
    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });
    expect(result.current.statuses.personal).toBe('error');
    expect(result.current.draft.personal.city).toBe('Tehran');
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    await act(async () => {
      await result.current.flush();
    });
    expect(calls).toBe(1);
    onlineManager.setOnline(true);
    act(() => {
      result.current.retry('personal');
    });
    await waitFor(() => expect(result.current.statuses.personal).toBe('saved'));
    const savedLeaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedLeaving);
    expect(savedLeaving.defaultPrevented).toBe(false);
  });

  it('holds incomplete rows and adopts new row IDs without losing an edit made during saving', async () => {
    const requests: InfoSection[] = [];
    const held = deferred();
    server.use(
      http.patch(ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as InfoSection;
        requests.push(body);
        if (requests.length === 1) await held.promise;
        return HttpResponse.json({
          ...initial,
          exams: body.exams?.map((row) => ({ ...row, id: 42 })),
        });
      }),
    );
    const { result } = setup();
    act(() => {
      result.current.update('exams', [{ localId: 'row-a', exam: '', score: '', date: '' }]);
    });
    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });
    expect(requests).toHaveLength(0);
    expect(result.current.statuses.exams).toBe('incomplete');
    act(() => {
      result.current.update('exams', [{ localId: 'row-a', exam: '1', score: '6', date: '' }]);
    });
    let saving!: Promise<boolean>;
    act(() => {
      saving = result.current.flush();
    });
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => {
      result.current.update('exams', [{ localId: 'row-a', exam: '1', score: '7', date: '' }]);
    });
    await act(async () => {
      held.resolve();
      await saving;
    });
    expect(requests[0]?.exams?.[0]).not.toHaveProperty('localId');
    expect(requests[1]?.exams?.[0]).toMatchObject({ id: 42, score: '7' });
    expect(result.current.draft.exams[0]).toMatchObject({ id: 42, localId: 'row-a', score: '7' });
    act(() => {
      result.current.update('exams', []);
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(requests[2]?.exams).toEqual([]);
  });

  it('flushes pending edits before allowing internal navigation', async () => {
    const held = deferred();
    server.use(
      http.patch(ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as InfoSection;
        await held.promise;
        return HttpResponse.json({ ...initial, ...body });
      }),
    );
    const { result, navigate, location } = setup();
    act(() => {
      result.current.update('goal', { ...initial.goal, language: 'B2' });
    });
    await act(async () => {
      await navigate('/else');
    });
    expect(location()).toBe('/info');
    expect(result.current.blocker.state).toBe('blocked');
    act(() => {
      held.resolve();
    });
    await waitFor(() => expect(location()).toBe('/else'));
  });
});
