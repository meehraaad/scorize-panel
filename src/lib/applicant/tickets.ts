import type { TicketsConfig, TicketsEndpoint } from '@/lib/tickets/api';
import { APPLICANT_KEY } from './approval';

/**
 * The applicant's tickets (docs/backend-changes.md H17–H21): the tickets page and the home page's
 * ticket card. Under APPLICANT_KEY, so a message sent on one shows on the other.
 */
export const APPLICANT_TICKETS: TicketsEndpoint = {
  api: '/applicant/v1/tickets',
  queryKey: APPLICANT_KEY,
};

/** The supervisors' thread (one per case). */
export const SUPERVISOR_THREAD = 'supervisor';

/**
 * The applicant's tickets page (and a writing form's ticket). Writing tickets are the same page:
 * Django sends one thread per writing order, under the «نگارش و سرچ» department.
 */
export const applicantTickets: TicketsConfig = {
  ...APPLICANT_TICKETS,
  path: '/tickets',
  viewer: 'applicant',
};

/** A writing order's thread id ('writing/sop'). */
export const writingThread = (type: string) => `writing/${type}`;
