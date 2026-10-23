import { readCookie } from './cookies';

/**
 * Django only sets the `csrftoken` cookie on responses from views that use the token. The panel is
 * static, so a first-time visitor has no cookie when they submit the login form.
 *
 * Until Django has a dedicated endpoint (docs/backend-changes.md, A9) we request the old login page,
 * which is decorated with @ensure_csrf_cookie. `redirect: 'manual'` keeps it cheap when Django
 * redirects (already logged in): the cookie is still set from the redirect response.
 */
const CSRF_BOOTSTRAP_URL = '/profile/authentication/login/';

let pending: Promise<void> | null = null;

export function ensureCsrfCookie(): Promise<void> {
  if (readCookie('csrftoken')) return Promise.resolve();
  pending ??= fetch(CSRF_BOOTSTRAP_URL, {
    credentials: 'same-origin',
    redirect: 'manual',
    headers: { Accept: 'text/html' },
  })
    .then(() => undefined)
    .finally(() => {
      pending = null;
    });
  return pending;
}
