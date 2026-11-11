import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ClauseKind } from '@/lib/contractText';
import { SALES_API, SALES_KEY, type Degree } from '@/lib/sales/api';
import { customerKey } from './customer';

export type ContractFeature = 'admission' | 'visa' | 'writing';

/** A kind of contract a seller can start from (S68); `id` null: the standard one. */
export interface OfferTemplate {
  id: number | null;
  name: string;
  description: string;
  /** Its services and their prices, toman (S71): what its card on the customer page shows. */
  features: { key: ContractFeature; price: number }[];
  /** S74: ISO code of the money the amounts are in; absent: IRT (toman). */
  currency?: string;
  /** How many articles its text has, and how many blanks the seller fills (S71). */
  articles: number;
  variables: number;
}

/** The customer's open offer, as the contract card on their page says it (S71). */
export interface OfferStatus {
  state: 'saved' | 'sent' | 'submitted' | 'returned';
  template: number | null;
  /** The kind of contract's name. */
  name: string;
  /** After the discount, in `currency`. */
  amount: number;
  /** S74: ISO code of the money the amounts are in; absent: IRT (toman). */
  currency?: string;
  updated_at: string;
  sent_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  /** Who returned it; empty unless returned. */
  reviewer: string;
}

export interface OfferOptions {
  /** The kind of contract these options are of (S68). */
  template: number | null;
  /** Every kind of contract on offer, the standard one first. */
  templates: OfferTemplate[];
  /** Price of each service, in `currency`; 0: free (a template's, S68). */
  features: { key: ContractFeature; price: number }[];
  degrees: Degree[];
  /** Months. */
  durations: number[];
  countries: string[];
  /** Percent; above `approval_above` the manager must approve before the customer sees it. */
  discounts: number[];
  approval_above: number;
  /** Percent of the amount at signing; less needs the manager (S64). */
  min_prepayment: number;
  max_applies: number;
  /** S74: the fewest applications; the offer starts at or above it. */
  min_applies: number;
  /** S74: ISO code of this contract's money (IRT: toman); prices, the amount and instalments are in it. */
  currency: string;
  /** S74: a contract amount outside this range goes to the manager first; null: no limit. */
  min_amount: number | null;
  max_amount: number | null;
  /** Instalment counts to start from; the seller can add or remove rows. */
  instalments: number[];
  /** The standard contract, in order. */
  clauses: StandardClause[];
  /** The blanks the seller fills (S69), and what the system fills itself. */
  variables: ContractVariable[];
  builtins: BuiltinVariable[];
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

/** A clause of the standard contract (Django's `ContractClause`, S51). */
export interface StandardClause {
  id: number;
  /** S69: an article (with a title), a clause or a note. */
  kind: ClauseKind;
  /** Only an article's. */
  title: string;
  text: string;
  /** A fixed clause (S64): the seller can't change or remove it. */
  locked: boolean;
}

/**
 * How this customer's contract differs from the standard one, a clause at a time (S51): `clause`
 * is the standard clause changed or removed, or null for a clause added. Only differences are kept.
 */
export interface ClauseEdit {
  clause: number | null;
  /** A standard clause keeps its own; a clause added picks one (S69). */
  kind: ClauseKind;
  /** Only an article's. */
  title: string;
  text: string;
  removed: boolean;
  /** A clause added goes after this standard clause; null: at the end (S69). */
  after: number | null;
}

/** A blank of the kind of contract the seller fills for each customer (S69), e.g. «تعداد سرچ». */
export interface ContractVariable {
  name: string;
  default: string;
}

/** What the system fills in a clause itself (the customer's name, the amount…), with a sample. */
export interface BuiltinVariable {
  name: string;
  sample: string;
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
  /** The clauses changed for this customer; the manager reviews only these. */
  clauses: ClauseEdit[];
  /** The kind of contract's blanks by name (S69); a missing one takes its default. */
  variables: Record<string, string>;
  manager_note: string;
  /** The kind of contract (S68); null: the standard one. */
  template: number | null;
}

export interface OfferData {
  options: OfferOptions;
  /** The saved draft, if any. */
  draft: Offer | null;
  /** Where the draft is: still editable, or sent. */
  state: 'none' | 'saved' | 'sent' | 'submitted';
  /** The sales manager's comment on a returned offer. */
  comment: string;
  /** The open offer for the customer page's card (S71); null: none. */
  status: OfferStatus | null;
}

/**
 * The offer page's options and draft. `template`: the options of that kind of contract (S68);
 * undefined: the draft's kind, or the standard one.
 */
export const offerQuery = (id: number, template?: number | null) =>
  queryOptions({
    queryKey: [
      ...customerKey(id),
      'offer',
      template === undefined ? 'draft' : (template ?? 'standard'),
    ],
    queryFn: ({ signal }) =>
      api<OfferData>(
        `${SALES_API}/customers/${String(id)}/offer/${
          template === undefined
            ? ''
            : `?template=${template === null ? 'standard' : String(template)}`
        }`,
        { signal },
      ),
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
