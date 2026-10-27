import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import type { WritingForm } from './api';
import type { Answers, FormSpec } from './formSpec';
import { useDraft } from './useDraft';
import { useFinal } from './useFinal';

const URL = '/api/applicant/v1/writing/sop/';
const form: WritingForm = {
  is_final: false,
  final_at: null,
  updated_at: null,
  answers: { reason: 'Ready' },
  contact_phone: null,
  orders: ['sop'],
};
const spec: FormSpec = {
  type: 'sop',
  progress: 'questions',
  aside: { tips: 0 },
  sections: [{ id: 'story', parts: [{ kind: 'textarea', name: 'reason', required: true }] }],
};
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let router: ReturnType<typeof createMemoryRouter>;
  const hook = renderHook(
    () => {
      const draft = useDraft('sop', form);
      const final = useFinal(spec, draft, vi.fn());
      return { draft, final };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => {
        router = createMemoryRouter([{ path: '*', element: children }], {
          initialEntries: ['/documents/sop'],
        });
        return (
          <QueryClientProvider client={client}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        );
      },
    },
  );
  return {
    ...hook,
    navigate: (path: string) => router.navigate(path),
    location: () => router.state.location.pathname,
  };
}
const event = { preventDefault: () => undefined };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const saved = () => HttpResponse.json({ updated_at: new Date().toISOString() });
beforeEach(async () => {
  await i18n.loadNamespaces('writing');
});
afterEach(() => {
  onlineManager.setOnline(true);
});

describe('writing draft and explicit final submission', () => {
  it('autosaves only a draft and never starts work, even with complete answers', async () => {
    const drafts: Answers[] = [];
    let finals = 0;
    server.use(
      http.patch(URL, async ({ request }) => {
        drafts.push(((await request.json()) as { answers: Answers }).answers);
        return saved();
      }),
      http.post(`${URL}final/`, () => {
        finals++;
        return HttpResponse.json({});
      }),
    );
    const { result } = setup();
    expect(drafts).toHaveLength(0);
    act(() => {
      result.current.draft.update('reason', 'An automatically saved draft');
    });
    await waitFor(() => expect(drafts).toEqual([{ reason: 'An automatically saved draft' }]));
    await waitFor(() => expect(result.current.draft.dirty).toBe(false));
    expect(finals).toBe(0);
    expect(result.current.final.confirming).toBe(false);
  });

  it('drains edits made during a slow draft save before sending one final request', async () => {
    const held = deferred();
    const calls: { method: string; answers: Answers }[] = [];
    server.use(
      http.patch(URL, async ({ request }) => {
        const body = (await request.json()) as { answers: Answers };
        calls.push({ method: 'draft', answers: body.answers });
        if (calls.length === 1) await held.promise;
        return saved();
      }),
      http.post(`${URL}final/`, async ({ request }) => {
        calls.push({
          method: 'final',
          answers: ((await request.json()) as { answers: Answers }).answers,
        });
        return HttpResponse.json({});
      }),
    );
    const { result } = setup();
    act(() => {
      result.current.draft.update('reason', 'First');
      result.current.draft.saveNow();
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => {
      result.current.draft.update('reason', 'Newest');
      result.current.final.finalize(event);
    });
    let submitting!: Promise<void>;
    act(() => {
      submitting = result.current.final.confirm();
      void result.current.final.confirm();
    });
    expect(calls).toHaveLength(1);
    expect(result.current.final.pending).toBe(true);
    await act(async () => {
      held.resolve();
      await submitting;
    });
    expect(calls).toEqual([
      { method: 'draft', answers: { reason: 'First' } },
      { method: 'draft', answers: { reason: 'Newest' } },
      { method: 'final', answers: { reason: 'Newest' } },
    ]);
  });

  it('preserves a failed offline draft and requires a new user confirmation to submit', async () => {
    onlineManager.setOnline(false);
    let patches = 0;
    let finals = 0;
    server.use(
      http.patch(URL, () => {
        patches++;
        return patches === 1 ? new HttpResponse(null, { status: 503 }) : saved();
      }),
      http.post(`${URL}final/`, () => {
        finals++;
        return HttpResponse.json({});
      }),
    );
    const { result } = setup();
    act(() => {
      result.current.draft.update('reason', 'Keep this');
      result.current.final.finalize(event);
    });
    await act(async () => {
      await result.current.final.confirm();
    });
    expect(result.current.draft.failed).toBe(true);
    expect(result.current.draft.answers.reason).toBe('Keep this');
    expect(finals).toBe(0);
    onlineManager.setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.draft.dirty).toBe(false));
    expect(finals).toBe(0);
    act(() => {
      result.current.final.finalize(event);
    });
    await act(async () => {
      await result.current.final.confirm();
    });
    expect(finals).toBe(1);
  });

  it('does not retry a failed final submission when the connection returns', async () => {
    onlineManager.setOnline(false);
    let finals = 0;
    server.use(
      http.post(`${URL}final/`, () => {
        finals++;
        return finals === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({});
      }),
    );
    const { result } = setup();
    act(() => {
      result.current.final.finalize(event);
    });
    await act(async () => {
      await result.current.final.confirm();
    });
    expect(finals).toBe(1);
    expect(result.current.final.confirming).toBe(false);
    act(() => {
      onlineManager.setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(finals).toBe(1);
    expect(result.current.draft.answers.reason).toBe('Ready');
    act(() => {
      result.current.final.finalize(event);
    });
    await act(async () => {
      await result.current.final.confirm();
    });
    expect(finals).toBe(2);
  });

  it('holds navigation on failure and keeps the answers available for retry', async () => {
    let failed = true;
    server.use(http.patch(URL, () => (failed ? new HttpResponse(null, { status: 503 }) : saved())));
    const { result, navigate, location } = setup();
    act(() => {
      result.current.draft.update('reason', 'Keep this too');
    });
    await act(async () => {
      await navigate('/documents/cv');
    });
    await waitFor(() => expect(result.current.draft.failed).toBe(true));
    expect(location()).toBe('/documents/sop');
    expect(result.current.draft.blocker.state).toBe('blocked');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    failed = false;
    act(() => {
      result.current.draft.saveNow();
    });
    await waitFor(() => expect(result.current.draft.dirty).toBe(false));
    expect(result.current.draft.answers.reason).toBe('Keep this too');
    await waitFor(() => expect(location()).toBe('/documents/cv'));
  });
});
