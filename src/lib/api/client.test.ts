import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, REQUEST_TIMEOUT_MS, request } from './client';

/** fetch that never answers, only rejects when its signal aborts. */
function hangingFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      }),
  );
}

describe('request', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns a request that hangs into a NetworkError', async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    hangingFetch();
    const pending = request('/api/slow/');
    timeout.abort(new DOMException('timed out', 'TimeoutError'));
    await expect(pending).rejects.toBeInstanceOf(NetworkError);
  });

  it('gives uploads extra time for their size', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    document.cookie = 'csrftoken=test';
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array(3_200_000)]), 'scan.pdf');
    body.append('note', 'x');
    await request('/api/upload/', { method: 'POST', body });
    await request('/api/plain/', { method: 'POST', body: { a: 1 } });
    expect(timeout).toHaveBeenNthCalledWith(1, REQUEST_TIMEOUT_MS + 100_000);
    expect(timeout).toHaveBeenNthCalledWith(2, REQUEST_TIMEOUT_MS);
    document.cookie = 'csrftoken=; max-age=0';
  });

  it('passes a caller cancel through unchanged', async () => {
    hangingFetch();
    const caller = new AbortController();
    const pending = request('/api/slow/', { signal: caller.signal });
    caller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(NetworkError);
  });
});
