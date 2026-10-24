import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import {
  PAYMENT_STATUS,
  STAFF_API,
  allPages,
  type DjangoInvoice,
  type DjangoPayment,
} from '@/lib/staff/api';
import { customerKey } from './customer';

/** finance.Payment.Status, by name. */
export const PAYMENT_STATUSES = PAYMENT_STATUS;
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
  /** Bank reference once paid online (Django doesn't send `ref_id` yet: S22). */
  reference: string | null;
  receipt: { url: string; uploaded_at: string } | null;
  /** Last time the invoice SMS went out, and whether the customer opened the link since (S22). */
  factor: { sent_at: string; opened: boolean } | null;
  /** The payment page link to share; empty when there is none (card transfers). */
  pay_url: string;
}

export interface PaymentsData {
  /** Destination accounts for card transfers; empty until Django lists them (S22). */
  wallets: { id: number; name: string }[];
  results: PaymentRow[];
}

/** What an invoice pays for: the product's title, else the payment's note or the invoice type. */
export const invoiceTitle = (invoice: DjangoInvoice, payment: Pick<DjangoPayment, 'description'>) =>
  invoice.purchasable?.title || payment.description || invoice.type_display;

/** The old site's payment link (finance:payment_ip_check), while the gateway waits. */
const payUrl = (authority: string | null) =>
  authority ? new URL(`/finance/payment/ip-check/${authority}/`, window.location.origin).href : '';

export function paymentRowOf(payment: DjangoPayment): PaymentRow {
  return {
    id: payment.id,
    what: payment.invoices.map((item) => invoiceTitle(item, payment)).join('، '),
    amount: payment.amount,
    // change_method sets an authority for online payment and clears it for a receipt.
    method: payment.authority ? 'online' : 'receipt',
    status: PAYMENT_STATUSES[payment.status] ?? 'pending',
    created_at: payment.creation_datetime,
    lines: payment.invoices.map((item) => ({
      label: invoiceTitle(item, payment),
      amount: item.amount,
    })),
    wallet: payment.wallet,
    reference: null,
    receipt: payment.receipt_file
      ? {
          url: payment.receipt_file,
          uploaded_at: payment.payment_date ?? payment.creation_datetime,
        }
      : null,
    factor: null,
    pay_url: payment.status === 0 ? payUrl(payment.authority) : '',
  };
}

/** The customer's payments, newest first: Django's PaymentViewSet until S22 ships. */
export const paymentsQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'payments'],
    queryFn: async ({ signal }): Promise<PaymentsData> => {
      const payments = await allPages<DjangoPayment>(
        `${STAFF_API}/users/${String(id)}/payments/?ordering=-creation_datetime`,
        signal,
      );
      return { wallets: [], results: payments.map(paymentRowOf) };
    },
  });

/** Existing staff endpoints of Django's PaymentViewSet (api/user_profile/staff). */
const staffPayment = (customer: number, payment: number) =>
  `${STAFF_API}/users/${String(customer)}/payments/${String(payment)}`;

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
