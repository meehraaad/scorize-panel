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

/**
 * Uploads get extra time for their size, at a slow mobile upload rate (~256 kbit/s), so a 10 MB
 * file has about 5.5 minutes instead of being cut off at 20 s.
 */
const SLOW_UPLOAD_BYTES_PER_MS = 32;

function timeoutFor(body: unknown) {
  if (!(body instanceof FormData)) return REQUEST_TIMEOUT_MS;
  let bytes = 0;
  for (const value of body.values()) if (value instanceof Blob) bytes += value.size;
  return REQUEST_TIMEOUT_MS + Math.ceil(bytes / SLOW_UPLOAD_BYTES_PER_MS);
}

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
  signal?: AbortSignal | undefined;
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
  const timeout = AbortSignal.timeout(timeoutFor(body));
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

export interface UploadOptions {
  method?: 'POST' | 'PUT' | 'PATCH';
  /** Bytes sent so far and in all, as the browser reports them. */
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal | undefined;
}

/**
 * Sends a FormData to /api with upload progress (fetch can't report it, so this is XMLHttpRequest).
 * Same headers, cookie and errors as `api()`. The request fails as a NetworkError when no bytes move
 * for REQUEST_TIMEOUT_MS, not after a fixed time: a big file on a slow line still gets through.
 */
export async function uploadApi<T>(
  path: string,
  body: FormData,
  { method = 'POST', onProgress, signal }: UploadOptions = {},
): Promise<T> {
  try {
    await ensureCsrfCookie(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  } catch (error) {
    throw new NetworkError(error);
  }
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stall: ReturnType<typeof setTimeout> | undefined;
    const idle = () => {
      clearTimeout(stall);
      stall = setTimeout(() => {
        xhr.abort();
        reject(new NetworkError(new Error('Upload stalled')));
      }, REQUEST_TIMEOUT_MS);
    };
    const done = () => {
      clearTimeout(stall);
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      done();
      xhr.abort();
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('Upload cancelled', 'AbortError'),
      );
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel);

    xhr.open(method, `${API_BASE}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Accept-Language', i18n.language);
    xhr.setRequestHeader('X-CSRFToken', readCookie('csrftoken') ?? '');
    xhr.upload.onprogress = (event) => {
      idle();
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      done();
      let data: unknown;
      try {
        data = xhr.status === 204 || !xhr.responseText ? null : JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(xhr.status, data));
    };
    xhr.onerror = () => {
      done();
      reject(new NetworkError(new Error('Upload failed')));
    };
    idle();
    xhr.send(body);
  });
}
