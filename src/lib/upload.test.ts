import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api/client';
import { AUTO_HIDE_MS, MAX_TOASTS, toast, useToasts } from '@/lib/toast';
import { OFFLINE_WAIT_MS, UploadCancelled, UploadFailed, uploadWithToast } from '@/lib/upload';

/** The toasts on screen right now (through the same store the <Toaster> reads). */
async function shown() {
  await Promise.resolve();
  return renderHook(() => useToasts()).result.current;
}

const file = { name: 'receipt.jpg', size: 2 * 1024 * 1024 };

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('toast store', () => {
  it('hides success after a while, keeps errors, and keeps at most three', async () => {
    vi.useFakeTimers();
    toast.success('Saved');
    toast.error('Not sent');
    vi.advanceTimersByTime(AUTO_HIDE_MS + 1);
    expect((await shown()).map((x) => x.title)).toEqual(['Not sent']);

    for (const n of [1, 2, 3, 4]) toast.error(`Error ${String(n)}`);
    expect((await shown()).map((x) => x.title)).toHaveLength(MAX_TOASTS);
    expect((await shown()).at(-1)?.title).toBe('Error 4');
  });

  it('waits while the person hovers a toast that would close itself', async () => {
    vi.useFakeTimers();
    const id = toast.success('Saved');
    toast.hold(id);
    vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
    expect(await shown()).toHaveLength(1);
    toast.release(id);
    vi.advanceTimersByTime(AUTO_HIDE_MS + 1);
    expect(await shown()).toHaveLength(0);
  });
});

describe('uploadWithToast', () => {
  it('shows progress, then success', async () => {
    let report: (sent: number, total: number) => void = () => {};
    let finish: (value: string) => void = () => {};
    const done = uploadWithToast([
      {
        ...file,
        send: (onProgress) => {
          report = onProgress;
          return new Promise<string>((resolve) => (finish = resolve));
        },
      },
    ]);
    await Promise.resolve();
    report(50, 100);
    const [uploading] = await shown();
    expect(uploading).toMatchObject({ kind: 'uploading', title: 'receipt.jpg', progress: 0.5 });
    expect(uploading?.meta).toContain('۵۰');

    finish('ok');
    await expect(done).resolves.toEqual(['ok']);
    expect((await shown())[0]).toMatchObject({ kind: 'success', meta: 'receipt.jpg' });
  });

  it('waits for the connection, picks up again, and fails only after the wait', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const send = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new NetworkError(new Error('offline')))
      .mockResolvedValueOnce('ok');
    const done = uploadWithToast([{ ...file, send }]);
    await vi.waitFor(async () => expect((await shown())[0]?.kind).toBe('paused'));

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
    await expect(done).resolves.toEqual(['ok']);
    expect(send).toHaveBeenCalledTimes(2);

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const retry = vi.fn();
    const failing = uploadWithToast(
      [{ ...file, send: () => Promise.reject(new NetworkError(new Error('offline'))) }],
      { retry },
    );
    const settled = failing.catch((error: unknown) => error);
    await vi.waitFor(async () => expect((await shown()).at(-1)?.kind).toBe('paused'));
    await vi.advanceTimersByTimeAsync(OFFLINE_WAIT_MS);
    expect(await settled).toBeInstanceOf(UploadFailed);
    const failed = (await shown()).at(-1);
    expect(failed?.kind).toBe('error');
    failed?.action?.run();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('lists several files and says which ones failed', async () => {
    const done = uploadWithToast([
      { name: 'a.pdf', size: 10, send: () => Promise.resolve('a') },
      { name: 'b.pdf', size: 10, send: () => Promise.reject(new ApiError(400, null)) },
    ]);
    const error: unknown = await done.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(UploadFailed);
    expect((error as UploadFailed).failed).toEqual([1]);
    expect((await shown())[0]).toMatchObject({ kind: 'error' });
    expect((await shown())[0]?.meta).toContain('۱');
  });

  it('cancels from the toast', async () => {
    const done = uploadWithToast([
      {
        ...file,
        send: (_progress, signal) =>
          new Promise<string>((_, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
          }),
      },
    ]);
    await Promise.resolve();
    (await shown())[0]?.onClose?.();
    await expect(done).rejects.toBeInstanceOf(UploadCancelled);
  });
});
