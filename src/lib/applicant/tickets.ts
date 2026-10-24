import type { TicketsEndpoint } from '@/lib/tickets/api';
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
