import { API_BASE, ApiError, NetworkError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { isStaleBuildError } from '@/lib/router/staleBuild';

/*
 * A crash in the panel's own code (a bug, not the server or the network) leaves no trace on the
 * server, so the error screen reports it and shows the code Django answers: the request ID that
 * the report is logged under (scorize api/metrics/v1/client_errors.py, docs/request-ids.md).
 */

export const CLIENT_ERRORS_ENDPOINT = `${API_BASE}/metrics/v1/errors/`;

/** Long opaque segments (a payment link's token) never go into the server's logs. */
export const safePage = (path: string) =>
  path.replace(/\/[\w-]{16,}(?=\/|$)/g, '/:token').slice(0, 200) || '/';

/** Only the panel's own failures: the server's carry their own code, a network problem has none. */
export function isClientCrash(error: unknown): error is Error {
  return (
    error instanceof Error &&
    !(error instanceof ApiError) &&
    !(error instanceof NetworkError) &&
    error.name !== 'AbortError' &&
    !isStaleBuildError(error)
  );
}

// One report per error: React may render a boundary more than once.
const sent = new WeakMap<Error, Promise<string | null>>();

async function send(error: Error): Promise<string | null> {
  const body = {
    message: `${error.name}: ${error.message}`.slice(0, 500) || error.name,
    stack: (error.stack ?? '').slice(0, 4000),
    page: safePage(window.location.pathname),
    build: import.meta.env.VITE_APP_BUILD ?? '',
  };
  try {
    // Straight fetch, like the speed reports: no CSRF token round trip (Django checks the origin
    // instead), since the app that would fetch one is the part that just broke.
    const response = await fetch(CLIENT_ERRORS_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { code?: unknown };
    return typeof data.code === 'string' ? data.code : null;
  } catch {
    return null;
  }
}

/** Reports a crash once and resolves to its support code, or null (not a crash, off, failed). */
export function reportClientCrash(error: unknown): Promise<string | null> {
  if (!ON_SERVER.clientErrors || !isClientCrash(error)) return Promise.resolve(null);
  let pending = sent.get(error);
  if (!pending) {
    pending = send(error);
    sent.set(error, pending);
  }
  return pending;
}
