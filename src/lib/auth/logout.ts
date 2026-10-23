import { queryClient } from '@/lib/api/queryClient';

// GET for now; should become POST (docs/backend-changes.md, A7). Django redirects to the site home.
const LOGOUT_URL = '/profile/authentication/logout/';

export function logout() {
  // Drop every cached response so nothing from this account survives in memory.
  queryClient.clear();
  window.location.assign(LOGOUT_URL);
}
