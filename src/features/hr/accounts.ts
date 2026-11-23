import { queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { HR_API, HR_KEY } from './api';

/**
 * The new-staff dialog's account lookup (OB12), apart from `./api`: the routes' page data imports
 * that, and this comes only with the dialog.
 */
/** An account found by its mobile (OB12): someone who used the site before, maybe already staff. */
export interface AccountMatch {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  /** Their staff file, when they have one (no second file is made). */
  staff_id: number | null;
}

/** OB12: the account with this mobile (`09…`), null when there is none. */
export const accountQuery = (phone: string) =>
  queryOptions({
    queryKey: [...HR_KEY, 'account', phone],
    queryFn: async ({ signal }) => {
      try {
        return await api<AccountMatch>(`${HR_API}/accounts/?phone=${phone}`, { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
