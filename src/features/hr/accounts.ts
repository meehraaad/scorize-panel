import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toLatinDigits } from '@/lib/text';
import { HR_API, HR_KEY } from './api';

/**
 * The new-staff dialog's live search of accounts by mobile (OB12), apart from `./api`: the
 * routes' page data imports that, and this comes only with the dialog.
 */
/** An account whose mobile starts with what HR typed: someone who used the site, maybe staff. */
export interface AccountMatch {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  email: string;
  /** Their staff file, when they have one (no second file is made). */
  staff_id: number | null;
}

/** What is searched: `09` and at least two more digits (Persian digits too), else null. */
export function phonePrefix(input: string): string | null {
  const digits = toLatinDigits(input).replace(/[\s-]/g, '');
  return /^09\d{2,9}$/.test(digits) ? digits : null;
}

/** OB12: up to 5 accounts whose mobile starts with `prefix`, the whole number first. */
export const accountSearchQuery = (prefix: string) =>
  queryOptions({
    queryKey: [...HR_KEY, 'accounts', prefix],
    queryFn: ({ signal }) =>
      api<{ results: AccountMatch[] }>(`${HR_API}/accounts/?phone=${prefix}`, { signal }).then(
        (page) => page.results,
      ),
    staleTime: 60_000,
  });
