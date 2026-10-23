import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, request } from './client';

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

  it('passes a caller cancel through unchanged', async () => {
    hangingFetch();
    const caller = new AbortController();
    const pending = request('/api/slow/', { signal: caller.signal });
    caller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(NetworkError);
  });
});
