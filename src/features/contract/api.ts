import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import type { ContractFeature } from '@/lib/applicant/access';
import { APPLICANT_KEY, type Degree } from '@/lib/applicant/approval';

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
  /** Toman. */
  amount: number;
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
  status: 'active' | 'ended';
  features: ContractFeature[];
  /** Localized by the server (Accept-Language). */
  countries: string[];
  degrees: Degree[];
  applies_total: number;
  /** Toman; null for a free contract. */
  total_amount: number | null;
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

/** Status of one invoice, as the applicant sees it. */
export type PaymentStatus = 'unpaid' | 'review' | 'declined' | 'paid';

export interface PaymentData {
  id: number;
  status: PaymentStatus;
  /** How it was (or is being) paid; null before the applicant chose. */
  method: 'online' | 'receipt' | null;
  /** The instalment it settles, when it is one (back link goes to the contract). */
  installment: number | null;
  items: { label: string; amount: number }[];
  /** Toman: sum of the items, credit used, and what is left to pay. */
  total: number;
  credit_used: number;
  amount: number;
  created_at: string;
  paid_at: string | null;
  seller: string | null;
  /** The uploaded receipt, while one is waiting or was declined. */
  receipt: { url: string; uploaded_at: string } | null;
  /** Why the sales team declined the receipt. */
  decline_reason: string | null;
  /** Where to transfer for a receipt payment (from the server, never hard-coded here). */
  bank: { card: string; iban: string; holder: string };
}

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

/** Starts an online payment; the browser then leaves for the bank gateway. */
export function useStartOnlinePayment() {
  return useMutation({
    mutationFn: (id: number) =>
      api<{ redirect_url: string }>(`${BASE}/payments/${String(id)}/online/`, { method: 'POST' }),
  });
}

export function useUploadReceipt() {
  return useApplicantMutation(({ id, file }: { id: number; file: File }) => {
    const body = new FormData();
    body.append('receipt', file);
    return api(`${BASE}/payments/${String(id)}/receipt/`, { method: 'POST', body });
  });
}
