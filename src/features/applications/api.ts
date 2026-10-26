import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY, type Degree } from '@/lib/applicant/approval';
import type { Stage } from '@/lib/applicant/stages';
import type { ApplicationResult, Approval, FeePayment } from '@/lib/applications';

/**
 * "Applications & results" of the applicant panel. Shapes: docs/backend-changes.md H5–H7.
 * A contract has at most a few dozen applications, so they come in one response and the page
 * filters, searches and pages them in the browser. Professor emails can run into hundreds:
 * those are paged by the server.
 */

export type { ApplicationResult, Approval, FeePayment } from '@/lib/applications';

export interface Application {
  id: number;
  university: string;
  degree: Degree;
  program: string;
  deadline: string | null;
  result: ApplicationResult | null;
  approval: Approval;
  fee: { amount: number; currency: string } | null;
  payment: FeePayment | null;
  /** Written by the supervisor for this application. */
  supervisor_note: string | null;
  /**
   * Accepted applications only: may Scorize show this admission on the site, with the applicant's
   * first name? null = not asked yet.
   */
  showcase: boolean | null;
  /** The university's country, localized by the server. */
  country: string;
  /** When the team sent it, and when its result came (null: not yet, or before Django kept them). */
  sent_at: string | null;
  result_at: string | null;
}

/** VisaResult.Status, named. */
export type VisaStatus =
  | 'getting_appointment'
  | 'pending_appointment'
  | 'pending_result'
  | 'granted'
  | 'refused'
  | 'missed_appointment'
  | 'canceled_appointment';

export interface VisaResult {
  id: number;
  title: string;
  /** Localized by the server. */
  destination: string;
  embassy: string;
  status: VisaStatus;
  appointment_at: string | null;
  resolved_at: string | null;
  appointment_proof: string | null;
  note: string | null;
}

export interface ApplicationsData {
  /** Where the case is (the home page's case stages). */
  stage: Stage;
  applies: { used: number; total: number };
  results: Application[];
  /** null: the contract has no visa services (the section is hidden). */
  visa: VisaResult[] | null;
}

export type ProfessorEmailStatus = 'sent' | 'reminded' | 'replied';

export interface ProfessorEmail {
  id: number;
  university: string;
  department: string;
  interests: string[];
  status: ProfessorEmailStatus;
}

/** DRF PageNumberPagination plus the reply count. */
export interface ProfessorEmailPage {
  count: number;
  replied: number;
  next: string | null;
  previous: string | null;
  results: ProfessorEmail[];
}

export const PROFESSORS_PAGE_SIZE = 5;

const BASE = '/applicant/v1';

export const applicationsQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'applications'],
  queryFn: async ({ signal }): Promise<ApplicationsData | null> => {
    try {
      return await api<ApplicationsData>(`${BASE}/applications/`, { signal });
    } catch (error) {
      // No applicant file yet (no contract).
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});

export const professorEmailsQuery = (page: number) =>
  queryOptions({
    queryKey: [...APPLICANT_KEY, 'professor-emails', page],
    queryFn: ({ signal }) =>
      api<ProfessorEmailPage>(
        `${BASE}/professor-emails/?page=${String(page)}&page_size=${String(PROFESSORS_PAGE_SIZE)}`,
        { signal },
      ),
    staleTime: 5 * 60_000,
    // Keep the current page on screen while the next one loads: no jump, no skeleton flash.
    placeholderData: keepPreviousData,
  });

export function useShowcaseAnswer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allowed }: { id: number; allowed: boolean }) =>
      api(`${BASE}/applications/${String(id)}/showcase/`, { method: 'POST', body: { allowed } }),
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}
