import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY, type Degree } from '@/lib/sales/api';
import { customerKey } from './customer';

export type ContractFeature = 'admission' | 'visa' | 'writing';

export interface OfferOptions {
  /** Price of each service, toman. */
  features: { key: ContractFeature; price: number }[];
  degrees: Degree[];
  /** Months. */
  durations: number[];
  countries: string[];
  /** Percent; above `approval_above` the manager must approve before the customer sees it. */
  discounts: number[];
  approval_above: number;
  /** Instalment counts to start from; the seller can add or remove rows. */
  instalments: number[];
}

/**
 * When an instalment is due (S47): `signing` is the prepayment (the first row, and only it); `date`
 * on `date`; the others at that step of the case (Django's `ApplicationPayment.PaymentCondition`).
 */
export const INSTALMENT_WHEN = [
  'signing',
  'date',
  'admission',
  'embassy',
  'visa_process',
  'visa',
] as const;
export type InstalmentWhen = (typeof INSTALMENT_WHEN)[number];

/** One instalment as the seller and the customer agreed it in the session. */
export interface Instalment {
  /** Toman. */
  amount: number;
  when: InstalmentWhen;
  /** ISO date, only when `when` is `date`. */
  date: string | null;
}

/** At most this many instalments (Django's `MAX_INSTALMENTS`). */
export const MAX_INSTALMENTS = 12;

export interface Offer {
  features: ContractFeature[];
  degree: Degree;
  applies: number;
  /** ISO date. */
  start: string;
  months: number;
  language_score: string;
  /** ISO date, or empty. */
  language_deadline: string;
  countries: string[];
  discount: number;
  /**
   * Amounts, count and dates are agreed in the session. `send` and `submit` need them to add up to
   * the price after the discount (400 otherwise); `save` keeps a half-done schedule.
   */
  schedule: Instalment[];
  manager_note: string;
}

export interface OfferData {
  options: OfferOptions;
  /** The saved draft, if any. */
  draft: Offer | null;
  /** Where the draft is: still editable, or sent. */
  state: 'none' | 'saved' | 'sent' | 'submitted';
}

export const offerQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'offer'],
    queryFn: ({ signal }) =>
      api<OfferData>(`${SALES_API}/customers/${String(id)}/offer/`, { signal }),
  });

/**
 * `save`: keep the draft; `send`: send the offer to the customer (SMS + panel); `submit`: send it
 * to the sales manager. The contract is made only when the manager approves (S32, S36).
 */
export type OfferAction = 'save' | 'send' | 'submit';

export function useSaveOffer(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ offer, action }: { offer: Offer; action: OfferAction }) =>
      api(`${SALES_API}/customers/${String(id)}/offer/`, {
        method: 'POST',
        body: { ...offer, action },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}
