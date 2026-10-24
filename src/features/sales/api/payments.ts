import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { customerKey } from './customer';

/** finance.Payment.Status, by name. */
export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'paid_by_receipt',
  'expired',
  'failed',
  'pending_receipt',
  'receipt_declined',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** finance.types.PaymentMethod (0 online, 1 receipt). */
export type PaymentMethod = 'online' | 'receipt';
const METHOD_CODE: Record<PaymentMethod, number> = { online: 0, receipt: 1 };

export interface PaymentRow {
  id: number;
  /** What it pays for, localized. */
  what: string;
  /** Toman, after discounts and credit. */
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
  lines: { label: string; amount: number }[];
  /** Destination account for card transfers (Payment.wallet). */
  wallet: number;
  /** Bank reference once paid online. */
  reference: string | null;
  receipt: { url: string; uploaded_at: string } | null;
  /** Last time the invoice SMS went out, and whether the customer opened the link since. */
  factor: { sent_at: string; opened: boolean } | null;
  /** The payment page link to share. */
  pay_url: string;
}

export interface PaymentsData {
  wallets: { id: number; name: string }[];
  results: PaymentRow[];
}

export const paymentsQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'payments'],
    queryFn: ({ signal }) =>
      api<PaymentsData>(`${SALES_API}/customers/${String(id)}/payments/`, { signal }),
  });

/** Existing staff endpoints of Django's PaymentViewSet (api/user_profile/staff). */
const staffPayment = (customer: number, payment: number) =>
  `/profile/staff/v1/users/${String(customer)}/payments/${String(payment)}`;

export type PaymentAction =
  | { kind: 'decline' }
  | { kind: 'method'; method: PaymentMethod }
  | { kind: 'factor' }
  | { kind: 'wallet'; wallet: number };

/**
 * What a seller does to an invoice. Declining a receipt and changing the method use the existing
 * staff endpoints; the invoice SMS and the destination account are new (S24, S25).
 * Confirming a receipt: useConfirmReceipt (lib/sales).
 */
export function usePaymentAction(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ payment, action }: { payment: number; action: PaymentAction }) => {
      switch (action.kind) {
        case 'decline':
          return api(`${staffPayment(customer, payment)}/decline_receipt/`, { method: 'PATCH' });
        case 'method':
          return api(
            `${staffPayment(customer, payment)}/change_method/${String(METHOD_CODE[action.method])}/`,
            { method: 'PATCH' },
          );
        case 'factor':
          return api(`${SALES_API}/payments/${String(payment)}/factor/`, { method: 'POST' });
        case 'wallet':
          return api(`${SALES_API}/payments/${String(payment)}/`, {
            method: 'PATCH',
            body: { wallet: action.wallet },
          });
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}
