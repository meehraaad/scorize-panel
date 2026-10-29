import i18n from '@/lib/i18n';
import { API_BASE, request } from '@/lib/api/client';
import { clearPersistedCache } from '@/lib/api/persist';
import { queryClient } from '@/lib/api/queryClient';
import { SITE } from '@/lib/site';
import { toast } from '@/lib/toast';

/** POST with the CSRF token (backend-changes.md A7); answers 204. */
const LOGOUT_URL = `${API_BASE}/profile/auth/v1/logout/`;

/**
 * Ends the Django session, then leaves the panel for the site home.
 * A request first, not a page navigation: the session is gone before the page changes. When it
 * doesn't reach Django, or Django refuses it (a 403 CSRF failure, a 500), the user is still logged
 * in, so they stay and are told. Django answers 204 even for a session that already ended.
 */
export async function logout() {
  const ended = await request(LOGOUT_URL, { method: 'POST' }).then(
    (response) => response.ok,
    () => false,
  );
  if (!ended) {
    toast.error(i18n.t('account.logoutFailed'));
    return;
  }
  // Drop every cached response so nothing from this account survives in memory.
  queryClient.clear();
  clearPersistedCache();
  window.location.assign(SITE.home);
}
