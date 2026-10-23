import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';

interface Permission {
  codename: string;
}

/** Subset of Django's WhoAmISerializer (api/user_profile/auth/serializers/v1.py) the panel uses. */
export interface SessionUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  /** SupportStaff (BDSupportStaffSerializer); null for customers and applicants. */
  staff: { id: number; full_name: string; team: number | null; is_active?: boolean } | null;
  is_superuser: boolean;
  /** Direct user permissions. */
  permissions: Permission[];
  /** Permissions inherited from the user's groups. */
  group_permissions: { name: string; permissions: Permission[] }[];
  /** Not in whoami yet (docs/backend-changes.md, R1). */
  applicant?: {
    contract_status: number;
    accepted_the_terms: boolean;
  } | null;
  /** Not in whoami yet (docs/backend-changes.md, R2). */
  is_country_supervisor?: boolean;
}

/** In-app path of the login page (the router adds the /panel base). */
export const LOGIN_PATH = '/login';

/** Where to land after login when no `next` was given: the router sends the user to their panel. */
export const START_PATH = '/start';

/**
 * The current user, or `null` when nobody is logged in.
 * Same URL index.html preloads, so on first load this request is usually already in flight.
 */
export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async ({ signal }): Promise<SessionUser | null> => {
    try {
      return await api<SessionUser>('/profile/auth/v1/whoami/', { signal });
    } catch (error) {
      // DRF session auth answers 403 (not 401) when nobody is logged in.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
      throw error;
    }
  },
  staleTime: 5 * 60_000,
});

export function useSession() {
  return useSuspenseQuery(sessionQuery).data;
}

/** For pages inside the authenticated area, where the router guarantees a user. */
export function useUser(): SessionUser {
  const user = useSession();
  if (!user) throw new Error('useUser() used outside the authenticated area');
  return user;
}

/** `/login?next=<current URL>` so the user comes back here after logging in. */
export function loginHref(nextPath: string) {
  return `${LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`;
}
