import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from './approval';

/**
 * What stands between the applicant and the panel (canvas V6 section 8), and the optional NPS
 * survey (section 14). The server decides; the panel shows the first gate that applies:
 * an inactive panel, then the terms, then the missing profile details, then supervisor surveys.
 * Shapes: docs/backend-changes.md H45–H49.
 */

export type ProfileGateField = 'passport_name' | 'relative_name' | 'relative_phone';

export const SURVEY_ANSWERS = ['very_satisfied', 'satisfied', 'neutral', 'dissatisfied'] as const;
export type SurveyAnswer = (typeof SURVEY_ANSWERS)[number];

export interface Gates {
  /** The contract's terms to accept before anything else (first login of a new case). */
  terms: { version: string; sections: { title: string; text: string }[] } | null;
  /** Details the case can't start without. */
  profile: { fields: ProfileGateField[] } | null;
  /** Monthly supervisor surveys still to answer. */
  surveys: { id: number; supervisor: string }[];
  /** The panel is closed (contract over); what stays reachable. */
  inactive: {
    file_number: number;
    /** The application email accounts the team made, to keep using. */
    credentials: { label: string; value: string; secret: boolean }[];
    support_email: string;
  } | null;
  /** The NPS survey is due; `credit` toman is added for answering. */
  nps: { credit: number } | null;
}

const BASE = '/applicant/v1/gates';

export const gatesQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'gates'],
  queryFn: ({ signal }) => api<Gates>(`${BASE}/`, { signal }),
  staleTime: 5 * 60_000,
});

function useGateMutation<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

export function useAcceptTerms() {
  return useGateMutation((version: string) =>
    api(`${BASE}/terms/`, { method: 'POST', body: { version } }),
  );
}

/** The same endpoint as the contract page's details (H23). */
export function useSaveGateProfile() {
  return useGateMutation((values: Partial<Record<ProfileGateField, string>>) =>
    api('/applicant/v1/profile/', { method: 'PATCH', body: values }),
  );
}

export function useAnswerSurvey() {
  return useGateMutation(({ id, answer }: { id: number; answer: SurveyAnswer }) =>
    api(`${BASE}/surveys/${String(id)}/`, { method: 'POST', body: { answer } }),
  );
}

export function useAnswerNps() {
  return useGateMutation((body: { score: number; comment: string } | { dismissed: true }) =>
    api(`${BASE}/nps/`, { method: 'POST', body }),
  );
}
