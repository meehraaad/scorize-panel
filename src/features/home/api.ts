import { queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY, type Degree } from '@/lib/applicant/approval';
import type { Stage } from '@/lib/applicant/stages';
import type { StaffRole, TicketMessage } from '@/lib/tickets/api';

export type { StaffRole, TicketMessage };

/**
 * "My case" home of the applicant panel: one request for the whole page, so a slow phone waits
 * for one round trip, not seven. Endpoint shape: docs/backend-changes.md (H1–H4).
 */

/** The six steps on the case card. */
export { STAGES, type Stage } from '@/lib/applicant/stages';

/** Contract.has_*_features that are on. */
export type ContractFeature = 'admission' | 'writing' | 'visa';

export type WritingType = 'sop' | 'cv' | 'recommendation' | 'ps' | 'ds' | 'pl';

/** ApplicationResult status as the applicant sees it (server maps Status + approval status). */
export type ApplicationStatus =
  'awaiting_approval' | 'ready' | 'in_progress' | 'submitted' | 'accepted' | 'rejected';

export interface Money {
  amount: number;
  /** ISO 4217, e.g. CAD, EUR. */
  currency: string;
}

export interface ApplicationSummary {
  id: number;
  university: string;
  degree: Degree;
  program: string;
  deadline: string | null;
  status: ApplicationStatus;
  fee: Money | null;
  fee_paid: boolean;
}

export type Todo =
  | { kind: 'approve'; id: string; application: ApplicationSummary }
  | { kind: 'upload'; id: string; document: string; due_date: string | null }
  | { kind: 'form'; id: string; writing: WritingType }
  | { kind: 'pay'; id: string; installment: number };

export interface ApplicantOverview {
  file: {
    applicant_id: number;
    features: ContractFeature[];
    /** Localized by the server (Accept-Language). */
    countries: string[];
    degrees: Degree[];
    applies_used: number;
    applies_total: number;
    start_date: string;
    end_date: string;
    stage: Stage;
  };
  stats: { submitted: number; accepted: number };
  todos: Todo[];
  /** The latest messages of the supervisors' thread (lib/tickets; replies go there too). */
  ticket: { unread: number; messages: TicketMessage[] } | null;
  deadlines: ApplicationSummary[];
  installment: {
    number: number;
    count: number;
    paid_count: number;
    /** In `currency`. */
    amount: number;
    /** ISO 4217, or `IRT` for the toman. */
    currency: string | null;
    is_due: boolean;
    /** When it falls due, written by staff ("after the TU Munich admission"). */
    condition: string | null;
    /** The invoice to pay it with, while it is due (payment page); else null. */
    payment_id: number | null;
  } | null;
  documents: { uploaded: number; required: number; next_due: string | null };
  writing: { type: WritingType; step: 1 | 2 | 3 }[];
  team: { name: string; role: StaffRole }[];
}

const BASE = '/applicant/v1';

export const overviewQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'overview'],
  queryFn: async ({ signal }): Promise<ApplicantOverview | null> => {
    try {
      return await api<ApplicantOverview>(`${BASE}/overview/`, { signal });
    } catch (error) {
      // No applicant file yet (no contract): the guest home.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});
