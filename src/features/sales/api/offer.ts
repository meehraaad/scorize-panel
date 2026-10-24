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
  instalments: number[];
}

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
  instalments: number;
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
 * `save`: keep the draft; `send`: send the offer to the customer (SMS + panel); `submit`: send the
 * contract draft to the sales manager (Contract with `creator`; S32).
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
