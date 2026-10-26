import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh app instance, as after a reload of the tab (sessionStorage survives it). */
async function reload() {
  vi.resetModules();
  const persist = await import('./persist');
  const { queryClient } = await import('./queryClient');
  persist.startCachePersistence();
  return { ...persist, queryClient };
}

describe('query cache kept across a reload of the tab', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the answers for the same user, never the session itself', async () => {
    const first = await reload();
    first.restoreCacheFor(7);
    first.queryClient.setQueryData(['applicant', 'overview'], { stage: 'applying' });
    first.queryClient.setQueryData(['session'], { id: 7 });
    vi.advanceTimersByTime(1500);
    expect(sessionStorage.getItem('scorize.cache')).not.toContain('"session"');

    const second = await reload();
    second.restoreCacheFor(7);
    expect(second.queryClient.getQueryData(['applicant', 'overview'])).toEqual({
      stage: 'applying',
    });
    expect(second.queryClient.getQueryData(['session'])).toBeUndefined();
  });

  it('never shows one account’s answers to another', async () => {
    const first = await reload();
    first.restoreCacheFor(7);
    first.queryClient.setQueryData(['applicant', 'overview'], { stage: 'applying' });
    vi.advanceTimersByTime(1500);

    const second = await reload();
    second.restoreCacheFor(8);
    expect(second.queryClient.getQueryData(['applicant', 'overview'])).toBeUndefined();
  });

  it('logout wipes it', async () => {
    const first = await reload();
    first.restoreCacheFor(7);
    first.queryClient.setQueryData(['applicant', 'overview'], { stage: 'applying' });
    vi.advanceTimersByTime(1500);
    first.clearPersistedCache();
    expect(sessionStorage.getItem('scorize.cache')).toBeNull();

    const second = await reload();
    second.restoreCacheFor(7);
    expect(second.queryClient.getQueryData(['applicant', 'overview'])).toBeUndefined();
  });
});
