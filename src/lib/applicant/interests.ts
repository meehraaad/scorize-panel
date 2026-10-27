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

export { guestInterestsQuery, type GuestInterests } from '@/lib/applicant/documents';

/** An account's interests before a case (H70). */
export function useSaveGuestInterests() {
  return useInterestsMutation(`${BASE}/profile/`);
}

/** Suggestions while typing: existing interests containing the text, most professors first. */
export interface InterestSuggestion {
  name: string;
  professors: number;
}

/** From this many letters (Django answers nothing below it). */
export const MIN_SUGGEST = 2;

export const interestSuggestionsQuery = (text: string) =>
  queryOptions({
    queryKey: [...APPLICANT_KEY, 'research-interests', 'search', text.toLowerCase()],
    queryFn: ({ signal }) =>
      api<{ results: InterestSuggestion[] }>(`${BASE}/search/?q=${encodeURIComponent(text)}`, {
        signal,
      }),
    staleTime: 5 * 60_000,
    enabled: text.length >= MIN_SUGGEST,
  });
