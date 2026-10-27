import { queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';

/*
 * An invoice by its public link (`/pay/<token>`, PAY3), apart from the payment page's API: the
 * router reads it before any panel loads, so it stays out of the payment page's chunk.
 */

/**
 * Status of one invoice, as the applicant sees it. `expired`: past its time (20 minutes, a seller's
 * 3 days); `failed`: the bank didn't take it; `checking`: the bank's answer didn't arrive and the
 * sales team checks it (PAY2, PAY9).
 */
export type PaymentStatus =
  'unpaid' | 'review' | 'declined' | 'paid' | 'expired' | 'failed' | 'checking';

/** An invoice by its public link (PAY3): what a signed-out visitor sees. */
export interface PublicInvoice {
  status: PaymentStatus;
  items: { label: string; amount: number }[];
  total: number;
  credit_used: number;
  amount: number;
  currency: string | null;
  created_at: string;
  paid_at: string | null;
  ref_id: string | null;
  seller: string | null;
  customer: string | null;
  /** Masked: 0912●●●6789. */
  phone: string | null;
  /** Set for its owner, signed in. */
  payment_id: number | null;
  other_account: boolean;
}

/** An invoice by its public link, signed out too; null when the link is unknown. */
export const publicInvoiceQuery = (token: string) =>
  queryOptions({
    queryKey: ['public-invoice', token],
    queryFn: async ({ signal }): Promise<PublicInvoice | null> => {
      try {
        return await api<PublicInvoice>(`/applicant/v1/invoices/${encodeURIComponent(token)}/`, {
          signal,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });
