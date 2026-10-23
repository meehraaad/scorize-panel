import i18n from '@/lib/i18n';
import { ensureCsrfCookie } from './csrf';
import { readCookie } from './cookies';

/**
 * Thin fetch wrapper for Django on the same origin.
 * - Auth is the Django session cookie (HttpOnly; no tokens in JS or storage).
 * - Unsafe methods send Django's CSRF token, fetching the cookie first if the browser has none.
 * - Accept-Language follows the panel language, so server messages match the UI.
 */

export const API_BASE = '/api';

/**
 * A request that hangs this long fails as a NetworkError, so a stalled mobile connection shows
 * "check your internet" instead of a button that spins forever.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

/** Django answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = 'ApiError';
  }
}

/** The request never reached Django, or got no answer in time (offline, DNS, timeout, blocked). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed', { cause });
    this.name = 'NetworkError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

export interface RawResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

/** Sends a request and returns status + parsed JSON without throwing on HTTP errors. */
export async function request(
  url: string,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<RawResponse> {
  const headers = new Headers({ Accept: 'application/json', 'Accept-Language': i18n.language });
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers.set('Content-Type', 'application/json');
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    if (method !== 'GET') {
      await ensureCsrfCookie(timeout);
      headers.set('X-CSRFToken', readCookie('csrftoken') ?? '');
    }
    response = await fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
    });
  } catch (error) {
    // Cancelled by the caller (React Query, unmount): not a failure. A timeout is.
    if (signal?.aborted) throw error;
    throw new NetworkError(error);
  }

  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

/** REST API call under /api: returns the JSON body or throws ApiError / NetworkError. */
export async function api<T>(path: string, options?: RequestOptions) {
  const { ok, status, data } = await request(`${API_BASE}${path}`, options);
  if (!ok) throw new ApiError(status, data);
  return data as T;
}
