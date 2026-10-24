import type { TicketsConfig } from '@/features/tickets/config';
import { APPLICANT_TICKETS } from '@/lib/applicant/tickets';

/**
 * The applicant's tickets page. Writing tickets are the same page: Django sends one thread per
 * writing order, under the «نگارش و سرچ» department.
 */
export const applicantTickets: TicketsConfig = {
  ...APPLICANT_TICKETS,
  path: '/tickets',
  viewer: 'applicant',
};
