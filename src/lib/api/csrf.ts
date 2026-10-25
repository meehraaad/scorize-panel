import { readCookie } from './cookies';

/**
 * Django only sets the `csrftoken` cookie on responses from views that use the token. The panel is
 * static, so a first-time visitor has no cookie when they submit the login form: this endpoint
 * (decorated with @ensure_csrf_cookie, backend-changes.md A9) sets it and answers 204.
 */
const CSRF_BOOTSTRAP_URL = '/api/profile/auth/v1/csrf/';

let pending: Promise<void> | null = null;

export function ensureCsrfCookie(signal?: AbortSignal): Promise<void> {
  if (readCookie('csrftoken')) return Promise.resolve();
  pending ??= fetch(CSRF_BOOTSTRAP_URL, {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  })
    .then(() => undefined)
    .finally(() => {
      pending = null;
    });
  return pending;
}
