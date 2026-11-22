import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { MOCK_CRASH_CODE } from '@/mocks/clientErrors';
import '@/test/server';
import { isClientCrash, reportClientCrash, safePage } from './clientErrors';

// A copy the tests can switch: the endpoint is off in the real file until Django ships it.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER } };
});
const setClientErrors = (on: boolean) => {
  (ON_SERVER as Record<string, boolean>).clientErrors = on;
};

describe('a crash in the panel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setClientErrors(false);
  });

  it('is reported once and answers the code it is logged under', async () => {
    setClientErrors(true);
    const send = vi.spyOn(globalThis, 'fetch');
    const crash = new TypeError("Cannot read properties of undefined (reading 'name')");
    const [first, second] = await Promise.all([reportClientCrash(crash), reportClientCrash(crash)]);
    expect(first).toBe(MOCK_CRASH_CODE);
    expect(second).toBe(MOCK_CRASH_CODE);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while the endpoint is off', async () => {
    const send = vi.spyOn(globalThis, 'fetch');
    expect(await reportClientCrash(new TypeError('boom'))).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves out what is not the panel’s own failure', () => {
    expect(isClientCrash(new TypeError('boom'))).toBe(true);
    expect(isClientCrash(new ApiError(500, null, 'abc12345'))).toBe(false);
    expect(isClientCrash(new NetworkError(new Error('offline')))).toBe(false);
    expect(isClientCrash(new TypeError('Failed to fetch dynamically imported module'))).toBe(false);
    expect(isClientCrash('a string')).toBe(false);
  });

  it('keeps payment tokens out of the page it reports', () => {
    expect(safePage('/pay/Xk29dk3ld9AkdP02md/receipt')).toBe('/pay/:token/receipt');
    expect(safePage('/cases/63437')).toBe('/cases/63437');
  });
});
