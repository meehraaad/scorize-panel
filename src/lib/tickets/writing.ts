import type { TicketsEndpoint } from './api';

export const WRITER_KEY = ['writer'] as const;
export const WRITER_INBOX_KEY = [...WRITER_KEY, 'inbox'] as const;
export const WRITER_API = '/writer/v1';

export const orderKey = (id: number) => [...WRITER_KEY, 'order', id] as const;

/** One writing order's conversation with the applicant, as staff. */
export const orderTickets = (id: number): TicketsEndpoint => ({
  api: `${WRITER_API}/orders/${String(id)}/tickets`,
  queryKey: orderKey(id),
  invalidateKeys: [WRITER_INBOX_KEY],
});
