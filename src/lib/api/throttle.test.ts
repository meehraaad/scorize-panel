import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionQuery, type SessionUser } from '@/lib/auth/session';
import { server } from '@/test/server';
import { api, ApiError } from './client';
import { queryClient } from './queryClient';

const WHOAMI = '/api/profile/auth/v1/whoami/';
const throttled = (seconds: string) =>
  HttpResponse.json({ detail: 'throttled' }, { status: 429, headers: { 'Retry-After': seconds } });

describe('a rate limit (429)', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('carries Retry-After on the error', async () => {
    server.use(http.get('/api/limited/', () => throttled('3')));
    const error = await api('/limited/').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).retryAfter).toBe(3);
  });

  it('is asked again once when it lifts within a few seconds', async () => {
    let calls = 0;
    server.use(
      http.get('/api/limited/', () => {
        calls += 1;
        return calls === 1 ? throttled('0') : HttpResponse.json({ ok: true });
      }),
    );
    const data = await queryClient.query({
      queryKey: ['limited'],
      queryFn: () => api<{ ok: boolean }>('/limited/'),
    });
    expect(data).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('is not retried when the wait is long', async () => {
    let calls = 0;
    server.use(
      http.get('/api/limited/', () => {
        calls += 1;
        return throttled('40');
      }),
    );
    await expect(
      queryClient.query({ queryKey: ['limited'], queryFn: () => api('/limited/') }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });

  it('keeps the user we know instead of failing the session check', async () => {
    const known = { id: 7, email: 'staff@example.com' } as unknown as SessionUser;
    server.use(http.get(WHOAMI, () => HttpResponse.json(known)));
    await queryClient.query(sessionQuery);
    server.use(http.get(WHOAMI, () => throttled('40')));
    const again = await queryClient.query({ ...sessionQuery, staleTime: 0 });
    expect(again).toEqual(known);
    expect(queryClient.getQueryState(sessionQuery.queryKey)?.status).toBe('success');
  });
});
