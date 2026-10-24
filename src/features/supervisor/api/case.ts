import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import { SUPERVISOR_API, type CaseStage, type Money, SUPERVISOR_KEY } from './common';

/** Why the professor-email bot can't send for this applicant. */
export type BotProblem =
  | { kind: 'few_texts'; have: number; need: number }
  | { kind: 'no_cv' }
  | { kind: 'no_interests' }
  | { kind: 'no_account' };

export type InstallmentStatus = 'paid' | 'due' | 'overdue' | 'upcoming';

export interface CaseInstallment {
  id: number;
  /** 0 = prepayment. */
  number: number;
  amount: Money;
  due_date: string | null;
  /** Staff text when it waits for an event ("after the first admission"). */
  condition: string | null;
  status: InstallmentStatus;
}

export interface CaseTask {
  id: number;
  text: string;
  due_at: string;
}

export interface CaseActivity {
  id: number;
  /** Written by the server ("Ali Rezaei recorded the TU Munich result as admitted"). */
  text: string;
  at: string;
}

export interface CaseData {
  id: number;
  /** The applicant's User id (tasks are about a person). */
  user: number;
  name: string;
  file_number: number;
  stage: CaseStage;
  phone: string;
  email: string;
  supervisors: string[];
  consultant: string | null;
  contract: {
    /** Localized name. */
    kind: string;
    degree: Degree | null;
    countries: string[];
    started_at: string;
    ends_at: string;
    total: Money | null;
    files: { name: string; url: string }[];
  };
  bot: { active: boolean; problems: BotProblem[] };
  progress: {
    suggested: number;
    applied: number;
    accepted: number;
    emails_sent: number;
    emails_total: number;
  };
  installments: CaseInstallment[];
  tasks: CaseTask[];
  /** The latest few; the activity tab has them all. */
  activity: CaseActivity[];
  /** Counts for the tabs. */
  unread: number;
  documents_waiting: number;
  applications: number;
}

export const caseKey = (id: number) => [...SUPERVISOR_KEY, 'case', id] as const;

export const caseQuery = (id: number) =>
  queryOptions({
    queryKey: caseKey(id),
    queryFn: async ({ signal }): Promise<CaseData | null> => {
      try {
        return await api<CaseData>(`${SUPERVISOR_API}/cases/${String(id)}/`, { signal });
      } catch (error) {
        // Not one of this supervisor's cases, or no such case.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

export function useSupervisorMutation<T, R = unknown>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    // Stage, documents and applications show on Today, the list and the case: refresh them all.
    onSuccess: () => client.invalidateQueries({ queryKey: SUPERVISOR_KEY }),
  });
}

export function useChangeStage(id: number) {
  return useSupervisorMutation(({ stage, note }: { stage: CaseStage; note: string }) =>
    api(`${SUPERVISOR_API}/cases/${String(id)}/stage/`, { method: 'POST', body: { stage, note } }),
  );
}
