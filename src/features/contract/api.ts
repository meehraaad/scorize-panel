import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import type { ContractFeature } from '@/lib/applicant/access';
import { APPLICANT_KEY, type Degree } from '@/lib/applicant/approval';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { safeHref } from '@/lib/url';

/**
 * "Contract & payment" of the applicant panel and the payment page (one invoice: an instalment or
 * a services purchase). Shapes: docs/backend-changes.md H22–H27.
 */

export type { ContractFeature };

/**
 * - `paid`: settled (online, or a receipt the sales team accepted)
 * - `due`: payable now (its date came, or its condition was met)
 * - `review`: a receipt was uploaded and waits for the sales team
 * - `upcoming`: not payable yet
 */
export type InstallmentStatus = 'paid' | 'due' | 'review' | 'upcoming';

export interface Installment {
  id: number;
  /** 0: the prepayment, then 1, 2, … */
  number: number;
  /** In `currency`. */
  amount: number;
  /** ISO 4217, or `IRT` for the toman; many contracts are priced in euros. */
  currency: string | null;
  status: InstallmentStatus;
  /** A fixed date to pay by; null when it depends on a step (`condition`). */
  due_date: string | null;
  /** When it falls due, written by staff ("after the first admission"). */
  condition: string | null;
  /** What happened that made it due, written by staff ("TU Munich admission recorded"). */
  note: string | null;
  paid_at: string | null;
  /** The invoice to pay it with (payment page); null while it isn't payable. */
  payment_id: number | null;
}

/** The applicant's details the team needs for university and embassy forms. */
export const PROFILE_FIELDS = [
  'file_id',
  'name',
  'email',
  'phone',
  'national_id',
  'birth_date',
  'passport_name',
  'postal_code',
  'home_phone',
  'address_en',
  'relative_name',
  'relative_phone',
  'relative_email',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export interface ContractFile {
  id: number;
  /** contract: the signed scan; customer_form: customer conditions form; terms: rules accepted. */
  kind: 'contract' | 'customer_form' | 'terms';
  url: string;
  /** PDF, HTML. */
  ext: string;
  /** Signed / issued / accepted on. */
  date: string;
}

export interface ContractData {
  /** Contract number (as on the paper contract). */
  number: number;
  holder: string;
  /** `turkey`: the free Turkey programme (no instalments, a pledge signed by SMS code). */
  kind: 'standard' | 'turkey';
  /** `pending`: approved, waiting for its prepayment and supervisor (set by the page, S46). */
  status: 'active' | 'ended' | 'pending';
  features: ContractFeature[];
  /** Localized by the server (Accept-Language). */
  countries: string[];
  degrees: Degree[];
  applies_total: number;
  /** Toman; null for a free contract. */
  total_amount: number | null;
  /** Of `total_amount`: ISO 4217, or `IRT` for the toman. */
  currency: string | null;
  start_date: string;
  end_date: string;
  /** Turkey: when the pledge was signed with the SMS code. */
  pledge_signed_at: string | null;
  installments: Installment[];
  profile: Record<ProfileField, string | null>;
  /** Fields the applicant may change (the rest are set by the team or the account). */
  editable: ProfileField[];
  files: ContractFile[];
  /** The consultant who follows up instalments. */
  consultant: string | null;
}

import type { PaymentStatus } from '@/lib/applicant/publicInvoice';

export type { PaymentStatus };

export type PaymentItemKind =
  | 'consultation'
  | 'writing'
  | 'campaign'
  | 'package'
  | 'webinar'
  | 'service'
  | 'lottery'
  | 'instalment'
  | 'other';

/** One line of the invoice and how its price came about (PAY6). */
export interface PaymentItem {
  /** Its invoice (null for an instalment); `removable`: can be taken out of the cart now. */
  id: number | null;
  removable: boolean;
  label: string;
  /** A session's start (ISO), when the item has one. */
  note: string | null;
  kind: PaymentItemKind;
  /** Its page in the panel, once bought. */
  href: string | null;
  /** The list price, then after the admin's discount (null: none). */
  price: number;
  discounted_price: number | null;
  /** What the discount code took off, the wallet credit it used and its tax. */
  code_discount: number;
  credit: number;
  tax: number;
  /** What is left to pay for it. */
  amount: number;
}

export interface PaymentData {
  id: number;
  status: PaymentStatus;
  /** How it was (or is being) paid; null before the applicant chose. */
  method: 'online' | 'receipt' | null;
  /** The instalment it settles, when it is one (back link goes to the contract). */
  installment: number | null;
  items: PaymentItem[];
  /** Sum of the items, credit used, and what is left to pay, in `currency`. */
  total: number;
  /** Sum of the list prices, the admin's discounts, the code (null: none) and the tax. */
  original: number;
  admin_discount: number;
  code: { code: string; discount: number } | null;
  tax: number;
  credit_used: number;
  /** Raised to the bank's minimum, or a price the seller set (negative: lower). */
  adjustment: number;
  amount: number;
  /** The receiving account's currency: ISO 4217, or `IRT` for the toman. */
  currency: string | null;
  created_at: string;
  /** When an unpaid invoice expires; null: it doesn't. */
  expires_at: string | null;
  paid_at: string | null;
  /** The bank's reference, once paid online. */
  ref_id: string | null;
  seller: string | null;
  /** The uploaded receipt, while one is waiting or was declined. */
  receipt: { url: string; uploaded_at: string } | null;
  /** Why the sales team declined the receipt. */
  decline_reason: string | null;
  /** Where to transfer for a receipt payment (from the server, never hard-coded here). */
  bank: { card: string; iban: string; holder: string };
  /** The code and the credit can change: unpaid, made by the person, not at the bank yet. */
  editable: boolean;
  /** The wallet's credit now (for the switch); null when it can't change. */
  wallet: number | null;
  use_credit: boolean;
  /** Toman purchases give this back to the wallet once paid. */
  reward: number;
  /** How an expired or failed one is bought again: a new invoice, from the seller, or its page. */
  renew: 'self' | 'seller' | 'rebook' | null;
  /** The open to-dos the purchase left (ids in the activities list). */
  activities: number[];
  /** Its public link: `/pay/<token>`. */
  token: string;
}

/** One open payment in the list (PAY7). */
export interface OpenPayment {
  id: number;
  status: PaymentStatus;
  labels: string[];
  installment: boolean;
  amount: number;
  currency: string | null;
  created_at: string;
  expires_at: string | null;
  due_date: string | null;
  seller: string | null;
}

export type { PublicInvoice } from '@/lib/applicant/publicInvoice';
export { publicInvoiceQuery } from '@/lib/applicant/publicInvoice';

export type DiscountResult = 'ok' | 'invalid' | 'expired' | 'used' | 'maxed' | 'not_for_items';

/** What the receipt upload accepts. The server checks again. */
export const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const BASE = '/applicant/v1';

export const contractQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'contract'],
  queryFn: async ({ signal }): Promise<ContractData | null> => {
    try {
      return await api<ContractData>(`${BASE}/contract/`, { signal });
    } catch (error) {
      // No applicant file yet (no contract).
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});

/** One invoice; null when it doesn't exist or isn't the applicant's. */
export const paymentQuery = (id: number) =>
  queryOptions({
    queryKey: [...APPLICANT_KEY, 'payment', id],
    queryFn: async ({ signal }): Promise<PaymentData | null> => {
      try {
        return await api<PaymentData>(`${BASE}/payments/${String(id)}/`, { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });

function useApplicantMutation<T, R = unknown>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

/** Saves one detail; the server answers with the stored (normalized) value. */
export function useSaveProfileField() {
  return useApplicantMutation(({ field, value }: { field: ProfileField; value: string }) =>
    api<Partial<Record<ProfileField, string>>>(`${BASE}/profile/`, {
      method: 'PATCH',
      body: { [field]: value },
    }),
  );
}

/** The person's open payments: unpaid, a receipt in review or declined (PAY7). */
export const openPaymentsQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'payments', 'open'],
  queryFn: ({ signal }) => api<OpenPayment[]>(`${BASE}/payments/?open=1`, { signal }),
  staleTime: 30_000,
});

/**
 * Starts an online payment: where the bank is, and whether the connection looks foreign (the bank
 * opens only from Iran: the page asks to turn off the VPN first).
 */
export function useStartOnlinePayment() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { redirect_url, outside_iran } = await api<{
        redirect_url: string;
        outside_iran?: boolean;
      }>(`${BASE}/payments/${String(id)}/online/`, { method: 'POST' });
      // Never navigate to a javascript: or data: URL, even one the API sent.
      const target = safeHref(redirect_url);
      if (!target) throw new Error('Unsafe payment redirect');
      return { redirect_url: target, outside_iran: outside_iran ?? false };
    },
  });
}

/** Writes the page's answer into the cache, so the page shows it without another request. */
function usePaymentWrite<T>(mutationFn: (variables: T) => Promise<PaymentData>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (payment) => {
      client.setQueryData(paymentQuery(payment.id).queryKey, payment);
      // A credit that now covers it all paid it: what it bought is in the lists now.
      if (payment.status === 'paid') void client.invalidateQueries({ queryKey: APPLICANT_KEY });
    },
  });
}

/** Takes the wallet credit, or gives it back (PAY5). */
export function useUseCredit() {
  return usePaymentWrite(({ id, use }: { id: number; use: boolean }) =>
    api<PaymentData>(`${BASE}/payments/${String(id)}/`, {
      method: 'PATCH',
      body: { use_credit: use },
    }),
  );
}

/** Takes one item out of the cart before the bank; the rest is priced again. */
export function useRemoveItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, item }: { id: number; item: number }) =>
      api<PaymentData>(`${BASE}/payments/${String(id)}/items/${String(item)}/`, {
        method: 'DELETE',
      }),
    onSuccess: (payment) => {
      client.setQueryData(paymentQuery(payment.id).queryKey, payment);
      // The item's own page (a seat, a booked time) no longer waits for this invoice.
      void client.invalidateQueries({
        queryKey: APPLICANT_KEY,
        predicate: (query) => query.queryKey[1] !== 'payment',
      });
    },
  });
}

/** Applies a discount code (`''` removes it); `result` says why one didn't apply. */
export function useApplyCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: number; code: string }) =>
      api<{ result: DiscountResult; payment: PaymentData }>(
        `${BASE}/payments/${String(id)}/discount/`,
        { method: 'POST', body: { code } },
      ),
    onSuccess: ({ payment }) => client.setQueryData(paymentQuery(payment.id).queryKey, payment),
  });
}

/**
 * A new invoice for an expired or failed one (PAY1, PAY2): its id, or null when the seller was
 * asked for one.
 */
export function useRenewPayment() {
  return useApplicantMutation((id: number) =>
    api<{ payment_id: number | null }>(`${BASE}/payments/${String(id)}/renew/`, {
      method: 'POST',
    }),
  );
}

export function useUploadReceipt() {
  return useApplicantMutation(
    ({ id, file, messages }: { id: number; file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('receipt', file);
      return uploadFile(`${BASE}/payments/${String(id)}/receipt/`, body, file, messages);
    },
  );
}

/** A campaign to register for in the panel (PAY10). */
export interface CampaignData {
  id: number;
  slug: string;
  title: string;
  description: string;
  /** Today's price after the admin's discount (0: free), and the price before it. */
  price: number;
  old_price: number | null;
  /** The background form before payment, after it, or none. */
  form_stage: 'before' | 'after' | null;
  wizard: 'personal' | 'basic' | 'downgrade' | null;
  /** null: no limit. */
  seats_left: number | null;
  form_complete: boolean;
  registration: { id: number; status: 'unpaid' | 'review' | 'paid'; payment_id: number } | null;
}

/** An open campaign by its slug; null when it is closed or unknown. */
export const campaignQuery = (slug: string) =>
  queryOptions({
    queryKey: [...APPLICANT_KEY, 'campaign', slug],
    queryFn: async ({ signal }): Promise<CampaignData | null> => {
      try {
        return await api<CampaignData>(`${BASE}/campaigns/${encodeURIComponent(slug)}/`, {
          signal,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });

/** Registers: the invoice to pay, or registered at once (free, or the credit covered it). */
export function useRegisterCampaign() {
  return useApplicantMutation((slug: string) =>
    api<{ payment_id: number; paid: boolean }>(
      `${BASE}/campaigns/${encodeURIComponent(slug)}/register/`,
      { method: 'POST' },
    ),
  );
}
