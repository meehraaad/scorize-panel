/**
 * The contract agreement desk (S62): one version of a contract offer, who has agreed to it, the
 * clauses with what differs, and the questions or change requests on it. The sales panel reads it
 * at `/sales/v1/customers/<user>/agreement/`, the customer at `/applicant/v1/offer/` (only their
 * own remarks). A new version needs everyone's agreement again.
 */
export type AgreementParty = 'seller' | 'consultant' | 'manager' | 'customer';
export const AGREEMENT_PARTIES: readonly AgreementParty[] = [
  'seller',
  'consultant',
  'manager',
  'customer',
];

export type ClauseChangeKind = 'changed' | 'added' | 'removed';

export interface AgreementClause {
  title: string;
  text: string;
  /** What differs from the standard contract; null: as the standard. */
  change: ClauseChangeKind | null;
  /** `changed`: the standard text it replaces. */
  base_text: string | null;
  /** Different from the previous version. */
  since_previous: boolean;
  /** Its text in the previous version, when it was different. */
  previous_text: string | null;
}

export interface AgreementRemark {
  id: number;
  version: number;
  /** The clause's title; null: about the whole offer. */
  clause: string | null;
  party: AgreementParty;
  author: string;
  text: string;
  created_at: string;
  answer: string | null;
  answered_at: string | null;
}

export interface Agreement {
  /** SalesOffer.State: `sent`, `submitted` (with the manager), `approved`… */
  state: string;
  version: number;
  amount: number;
  versions: { number: number; created_at: string; author: string }[];
  /** In order; the consultant only when someone else than the seller held the session. */
  parties: { party: AgreementParty; name: string; agreed_at: string | null }[];
  /** The viewer's part; null: a colleague who only reads. */
  you: AgreementParty | null;
  /** Everyone agreed on this version. */
  agreed: boolean;
  /** The offer's terms as text (`key`: services, degree, countries, applies, period, amount…). */
  lines: { key: string; value: string; previous: string | null }[];
  clauses: AgreementClause[];
  remarks: AgreementRemark[];
  /** Remarks on this version still without an answer. */
  open_remarks: number;
}

export const agreedBy = (agreement: Agreement, party: AgreementParty) =>
  agreement.parties.find((row) => row.party === party)?.agreed_at != null;
