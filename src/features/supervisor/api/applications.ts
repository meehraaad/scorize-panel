import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import type { ApplicationResult, Approval, FeePayment } from '@/lib/applications';
import { type BotProblem, caseKey, useSupervisorMutation } from './case';
import { SUPERVISOR_API, type Money } from './common';

export interface BotStatus {
  active: boolean;
  sent_today: number;
  daily_limit: number;
  /** The Gmail account the bot sends from. */
  account: string | null;
  problems: BotProblem[];
}

export interface CaseApplication {
  id: number;
  university: string;
  program: string;
  degree: Degree;
  deadline: string | null;
  fee: Money | null;
  payment: FeePayment | null;
  result: ApplicationResult | null;
  approval: Approval;
  /** Shown to the applicant under the application. */
  note: string | null;
}

/** What the side editor sends (create or update). */
export type ApplicationInput = Omit<CaseApplication, 'id' | 'approval'>;

export interface Credential {
  label: string;
  value: string;
  secret: boolean;
}

export interface CaseApplications {
  applies: { used: number; total: number };
  bot: BotStatus;
  applications: CaseApplication[];
  emails: { sent: number; total: number; replied: number };
  /** The application accounts the team made (also kept after the panel closes). */
  credentials: Credential[];
}

export const applicationsQuery = (id: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'applications'],
    queryFn: ({ signal }) =>
      api<CaseApplications>(`${SUPERVISOR_API}/cases/${String(id)}/applications/`, { signal }),
  });

export function useSaveApplication(id: number) {
  return useSupervisorMutation(
    ({ application, values }: { application: number | null; values: ApplicationInput }) =>
      application === null
        ? api(`${SUPERVISOR_API}/cases/${String(id)}/applications/`, {
            method: 'POST',
            body: values,
          })
        : api(`${SUPERVISOR_API}/cases/${String(id)}/applications/${String(application)}/`, {
            method: 'PATCH',
            body: values,
          }),
  );
}

export function useDeleteApplication(id: number) {
  return useSupervisorMutation((application: number) =>
    api(`${SUPERVISOR_API}/cases/${String(id)}/applications/${String(application)}/`, {
      method: 'DELETE',
    }),
  );
}

export function useSetBot(id: number) {
  return useSupervisorMutation((active: boolean) =>
    api(`${SUPERVISOR_API}/cases/${String(id)}/bot/`, { method: 'POST', body: { active } }),
  );
}

export type ProfessorEmailStatus = 'queued' | 'sent' | 'reminded' | 'replied' | 'bounced';

export interface ProfessorEmailRow {
  id: number;
  professor: string;
  university: string;
  sent_at: string | null;
  status: ProfessorEmailStatus;
}

export interface ProfessorEmailsPage {
  count: number;
  page_size: number;
  results: ProfessorEmailRow[];
}

export const professorEmailsQuery = (id: number, page: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'emails', page],
    queryFn: ({ signal }) =>
      api<ProfessorEmailsPage>(
        `${SUPERVISOR_API}/cases/${String(id)}/professor-emails/?page=${String(page)}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
