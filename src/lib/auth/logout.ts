import { queryClient } from '@/lib/api/queryClient';
import { SITE } from '@/lib/site';

// GET for now; should become POST (docs/backend-changes.md, A7).
const LOGOUT_URL = '/profile/authentication/logout/';

/**
 * Ends the Django session, then leaves the panel for the site home.
 * A request first, not a page navigation: the session is gone before the page changes (and API
 * mocks can answer it), whatever the server does with the redirect.
 */
export async function logout() {
  try {
    await fetch(LOGOUT_URL, { credentials: 'same-origin', redirect: 'manual' });
  } catch {
    // Offline or blocked: navigating to the logout page below still logs out.
    window.location.assign(LOGOUT_URL);
    return;
  }
  // Drop every cached response so nothing from this account survives in memory.
  queryClient.clear();
  // With API mocks there is no main site: back to the panel's login page.
  const mocked = import.meta.env.DEV && import.meta.env.VITE_API_MOCKS === 'true';
  window.location.assign(mocked ? `${import.meta.env.BASE_URL}login` : SITE.home);
}
