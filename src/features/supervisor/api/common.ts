export const SUPERVISOR_KEY = ['supervisor'] as const;
/** The supervisor endpoints, under API_BASE. */
export const SUPERVISOR_API = '/supervisor/v1';

/** Applicant.status, named: where the case is. */
export const CASE_STAGES = [
  'documents',
  'writing',
  'applying',
  'admitted',
  'visa',
  'on_hold',
  'closed',
] as const;
export type CaseStage = (typeof CASE_STAGES)[number];

/** A writing order (SOP, CV) as the list shows it. */
export type WritingState = 'waiting_info' | 'writing' | 'final';

export interface DocCount {
  uploaded: number;
  required: number;
}

export interface Money {
  amount: number;
  /** ISO 4217 (EUR, CAD, IRR shown as toman by the server's amount). */
  currency: string;
}
