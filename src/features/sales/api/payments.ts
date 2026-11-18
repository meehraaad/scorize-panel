import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';

import { customerKey } from './customer';
import type { Instalment } from './month';

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
export const METHOD_CODE: Record<PaymentMethod, number> = { online: 0, receipt: 1 };

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
  /** The payment page link to share; empty when there is none (card transfers). */
  pay_url: string;
}

/** An instalment of the customer's contract (`customer_instalments`). */
export interface CustomerInstalment extends Instalment {
  /** A receipt of it waits for review. */
  review: boolean;
}

export interface PaymentsData {
  /** Destination accounts for card transfers. */
  wallets: { id: number; name: string }[];
  results: PaymentRow[];
  /** The customer's contract instalments, the prepayment first; empty without a contract. */
  instalments: CustomerInstalment[];
  /** The seller may confirm receipts: one they record is paid at once, else it waits for review. */
  confirms_receipts: boolean;
}

/** The customer's payments, newest first, and the destination accounts (S22). */
export const paymentsQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'payments'],
    queryFn: ({ signal }) =>
      api<PaymentsData>(`${SALES_API}/customers/${String(id)}/payments/`, { signal }),
  });

/** Django's PaymentViewSet (api/user_profile/staff): declining and the method stay there (S23). */
export const staffPayment = (customer: number, payment: number) =>
  `/profile/staff/v1/users/${String(customer)}/payments/${String(payment)}`;

export type PaymentAction =
  | { kind: 'decline'; reason: string }
  | { kind: 'method'; method: PaymentMethod }
  | { kind: 'factor' }
  | { kind: 'wallet'; wallet: number };

/** What the receipt upload accepts (Django checks again, by content). */
export const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
