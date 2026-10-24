import { ApiError, NetworkError, uploadApi } from '@/lib/api/client';
import i18n from '@/lib/i18n';
import { DEFAULT_LOCALE, LOCALES, isLocale } from '@/lib/i18n/config';
import { toast, type ToastFile } from '@/lib/toast';

/**
 * Uploads with the upload toast (canvas "Scorize Seller Panel" › اعلان بارگذاری): progress ring,
 * "offline, picks up when you're back", then success or an error with "send again". The toast is
 * the only message an upload needs: callers don't show their own error for it.
 */

export interface UploadJob<T> {
  /** File name shown in the toast. */
  name: string;
  /** Bytes, for "1.2 of 1.9 MB" before the browser reports the real total. */
  size: number;
  send: (onProgress: (sent: number, total: number) => void, signal: AbortSignal) => Promise<T>;
}

export interface UploadMessages {
  /** "Receipt uploaded". Defaults to "Uploaded" (one file) or "All files uploaded". */
  done?: string | undefined;
  /** A line under it: "Sent to the finance team for review". */
  doneMeta?: string | undefined;
  /** "Receipt not sent". Defaults to "Upload didn't finish". */
  failed?: string | undefined;
  /** "Send again" re-runs the whole action (the caller's mutation), not just the request. */
  retry?: (() => void) | undefined;
}

/** Some jobs failed (indexes into the jobs); the rest went through. Already shown in the toast. */
export class UploadFailed extends Error {
  constructor(
    readonly failed: number[],
    readonly errors: unknown[],
  ) {
    super('Upload failed');
    this.name = 'UploadFailed';
  }
}

/** The person cancelled from the toast: nothing to report. */
export class UploadCancelled extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelled';
  }
}

/** How long an upload waits for the connection to come back before it counts as failed. */
export const OFFLINE_WAIT_MS = 30_000;

function formatters() {
  const locale = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const tag = LOCALES[locale].intl;
  const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const mb = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    percent: (value: number) => whole.format(Math.round(value * 100)),
    mb: (bytes: number) => mb.format(bytes / (1024 * 1024)),
    number: (value: number) => whole.format(value),
  };
}

/** Resolves when the browser is online again, or false after OFFLINE_WAIT_MS (or on cancel). */
function waitForOnline(signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    const finish = (online: boolean) => {
      clearTimeout(timer);
      window.removeEventListener('online', back);
      signal.removeEventListener('abort', stop);
      resolve(online);
    };
    const back = () => finish(true);
    const stop = () => finish(false);
    const timer = setTimeout(stop, OFFLINE_WAIT_MS);
    window.addEventListener('online', back);
    signal.addEventListener('abort', stop);
  });
}

const offline = (error: unknown) => error instanceof NetworkError && !navigator.onLine;

/** Runs the jobs one after another under one toast and resolves with their results in order. */
export async function uploadWithToast<T>(
  jobs: readonly UploadJob<T>[],
  messages: UploadMessages = {},
): Promise<T[]> {
  const t = i18n.t.bind(i18n);
  const f = formatters();
  const controller = new AbortController();
  const cancelled = () => controller.signal.aborted;
  const several = jobs.length > 1;
  const total = jobs.reduce((sum, job) => sum + job.size, 0) || 1;
  const sent = jobs.map(() => 0);
  const state: ToastFile['state'][] = jobs.map(() => 'wait');
  const results: T[] = [];
  const failed: number[] = [];
  const errors: unknown[] = [];
  let stoppedAt = 0;

  const files = (): ToastFile[] | undefined =>
    several
      ? jobs.map((job, index) => ({
          name: job.name,
          state: state[index] ?? 'wait',
          progress: job.size ? (sent[index] ?? 0) / job.size : 0,
        }))
      : undefined;
  const overall = () => sent.reduce((sum, value) => sum + value, 0) / total;
  const progressMeta = () =>
    several
      ? t('toast.upload.batchProgress', {
          done: f.number(state.filter((s) => s === 'done').length),
          count: f.number(jobs.length),
          percent: f.percent(overall()),
        })
      : t('toast.upload.progress', {
          percent: f.percent(overall()),
          sent: f.mb(sent[0] ?? 0),
          total: f.mb(jobs[0]?.size ?? 0),
        });

  const id = toast.show('uploading', {
    title: several
      ? t('toast.upload.batchTitle', { n: f.number(jobs.length) })
      : (jobs[0]?.name ?? ''),
    meta: progressMeta(),
    progress: 0,
    files: files(),
    closeLabel: t(several ? 'toast.upload.cancelAll' : 'toast.upload.cancel'),
    onClose: () => controller.abort(),
  });
  const refresh = () =>
    toast.update(id, {
      kind: 'uploading',
      meta: progressMeta(),
      progress: overall(),
      files: files(),
    });

  for (const [index, job] of jobs.entries()) {
    state[index] = 'up';
    refresh();
    for (;;) {
      try {
        const result = await job.send((loaded, size) => {
          // The multipart body is a little bigger than the file: scale to the file's size.
          sent[index] = size ? (loaded / size) * job.size : 0;
          refresh();
        }, controller.signal);
        results[index] = result;
        sent[index] = job.size;
        state[index] = 'done';
        refresh();
        break;
      } catch (error) {
        if (cancelled()) throw new UploadCancelled();
        if (offline(error)) {
          toast.update(id, {
            kind: 'paused',
            meta: t('toast.upload.paused', { percent: f.percent(overall()) }),
          });
          if (await waitForOnline(controller.signal)) continue;
          if (cancelled()) throw new UploadCancelled();
        }
        failed.push(index);
        errors.push(error);
        stoppedAt = overall();
        sent[index] = 0;
        state[index] = 'wait';
        break;
      }
    }
  }

  if (failed.length) {
    const serverRefused = errors.some((error) => error instanceof ApiError);
    toast.update(id, {
      kind: 'error',
      title: messages.failed ?? t('toast.upload.failed'),
      meta: several
        ? t('toast.upload.batchFailedMeta', {
            failed: f.number(failed.length),
            count: f.number(jobs.length),
          })
        : serverRefused
          ? undefined
          : t('toast.upload.failedMeta', { percent: f.percent(stoppedAt) }),
      progress: undefined,
      files: undefined,
      closeLabel: undefined,
      onClose: undefined,
      action: messages.retry
        ? {
            label: t('toast.upload.retry'),
            run: () => {
              toast.dismiss(id);
              messages.retry?.();
            },
          }
        : undefined,
    });
    throw new UploadFailed(failed, errors);
  }

  toast.update(id, {
    kind: 'success',
    title: messages.done ?? t(several ? 'toast.upload.batchDone' : 'toast.upload.done'),
    meta: messages.doneMeta ?? (several ? undefined : jobs[0]?.name),
    progress: undefined,
    files: undefined,
    closeLabel: undefined,
    onClose: undefined,
  });
  return results;
}

/** One FormData to `path` (under /api) for one picked file, under the upload toast. */
export async function uploadFile<T>(
  path: string,
  body: FormData,
  file: { name: string; size: number },
  messages?: UploadMessages,
): Promise<T> {
  const [result] = await uploadWithToast(
    [
      {
        name: file.name,
        size: file.size,
        send: (onProgress, signal) => uploadApi<T>(path, body, { onProgress, signal }),
      },
    ],
    messages,
  );
  return result as T;
}
