import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * The ticket replies staff pick from in the composer (the messages section's "ready messages",
 * kind `ticket`; Django `api/messages/v1/ticket-replies/`). Only those that are on.
 */
export interface ReadyReply {
  id: number;
  title: string;
  /** With `{customer}` and `{seller}` (the staff member) still in it. */
  text: string;
}

export const ticketRepliesQuery = queryOptions({
  queryKey: ['messages', 'ticket-replies'],
  queryFn: ({ signal }) => api<ReadyReply[]>('/messages/v1/ticket-replies/', { signal }),
  staleTime: 5 * 60_000,
});

/** Fills a ready message's `{customer}` and `{seller}`, as Django does for sellers. */
export const fillReady = (text: string, values: { customer: string; seller: string }) =>
  text.replaceAll('{customer}', values.customer).replaceAll('{seller}', values.seller);
