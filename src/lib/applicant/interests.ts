import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * Research interests (English topics, `apply.ResearchInterest`): the professor-email bot searches
 * with them and the CV lists them. A case keeps them on its applicant (H11); before a case, the
 * account keeps them (H70) and the case starts with them.
 */

export const MAX_INTEREST_LENGTH = 64;
export const MAX_INTERESTS = 20;

const BASE = '/applicant/v1/research-interests';

/** Replaces the list (the server matches each name to its `ResearchInterest`, or creates it). */
export type SaveInterests = ReturnType<typeof useSaveInterests>;

function useInterestsMutation(url: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (interests: string[]) => api(url, { method: 'PUT', body: { interests } }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

/** A case's interests (H11). */
export function useSaveInterests() {
  return useInterestsMutation(`${BASE}/`);
}

/** Interests and how many professors in Scorize's list work on them, before a case (H70, H71). */
export interface GuestInterests {
  interests: string[];
  /** Professors whose interests match one of these, and their universities. */
  professors: number;
  universities: number;
  /** A few of them, without names: the country and the interest they share. */
  sample: { country: string; interest: string }[];
}

export const guestInterestsQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'research-interests', 'guest'],
  queryFn: ({ signal }) => api<GuestInterests>(`${BASE}/profile/`, { signal }),
  staleTime: 60_000,
});

/** An account's interests before a case (H70). */
export function useSaveGuestInterests() {
  return useInterestsMutation(`${BASE}/profile/`);
}
