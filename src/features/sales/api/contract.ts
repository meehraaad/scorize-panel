import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AgreementParty } from '@/lib/agreement/api';
import { api } from '@/lib/api/client';
import type { TextClause } from '@/lib/contractText';
import { SALES_API, type Degree } from '@/lib/sales/api';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import { customerKey } from './customer';

/**
 * The approved contract's handoff (docs/backend-changes.md S43–S45): signed on paper, the scan
 * uploaded here, the prepayment paid, then a manager hands the case to a supervisor.
 * `signing` → `payment` → `supervisor` (waiting for the manager) → `active`.
 */
export type HandoffState = 'signing' | 'payment' | 'supervisor' | 'active';
export const HANDOFF_STEPS: readonly HandoffState[] = [
  'signing',
  'payment',
  'supervisor',
  'active',
];

export interface ContractScan {
  id: number;
  url: string;
  uploaded_at: string;
}

export interface Prepayment {
  payment_id: number;
  /** Toman. */
  amount: number;
  status: 'unpaid' | 'review' | 'declined' | 'paid';
}

export interface HandoffContract {
  id: number;
  /** The applicant file. */
  case: number;
  state: HandoffState;
  scans: ContractScan[];
  prepayment: Prepayment | null;
  instalments: number;
  /** Names, once the case started. */
  supervisors: string[];
}

export const SCAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_SCAN_BYTES = 10 * 1024 * 1024;

export const handoffQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'contract'],
    queryFn: ({ signal }) =>
      api<{ contract: HandoffContract | null }>(`${SALES_API}/customers/${String(id)}/contract/`, {
        signal,
      }),
  });

/** One page of the signed contract, or the whole file. */
/** S52: the approved contract as it is printed and signed. */
export interface ContractDocument {
  /** Null before the manager approves: an offer's contract read as a preview (S68). */
  number: number | null;
  /** The applicant file number; null before approval. */
  file_id: string | null;
  approved_at: string | null;
  /** Not approved yet: a preview (S68). */
  draft?: boolean;
  /** The kind of contract (S68), e.g. "اپلای رایگان ترکیه"; empty for the standard one. */
  template?: string;
  customer: { name: string; national_code: string | null; phone: string | null; email: string };
  seller: string;
  features: ('admission' | 'writing' | 'visa')[];
  degrees: Degree[];
  /** Localized by the server. */
  countries: string[];
  applies: number;
  start_date: string;
  end_date: string;
  months: number;
  language_score: string;
  language_deadline: string | null;
  /** Toman. */
  amount: number;
  /** The prepayment first (number 0); `condition` localized by the server. Empty: a free contract. */
  installments: {
    id: number;
    number: number;
    amount: number;
    due_date: string | null;
    condition: string | null;
  }[];
  /**
   * The contract's text as approved: the standard clauses with this customer's changes, as
   * articles, clauses and notes with their variables filled (S69).
   */
  clauses: TextClause[];
  /**
   * Who agreed online on the approved version (S62), and the clauses written for this customer
   * (titles); null for a contract made before the agreement desk.
   */
  agreement?: {
    version: number;
    changed: string[];
    parties: { party: AgreementParty; name: string; agreed_at: string }[];
  } | null;
}

export const contractDocumentQuery = (id: number) =>
  queryOptions({
    queryKey: [...customerKey(id), 'contract', 'document'],
    queryFn: ({ signal }) =>
      api<ContractDocument>(`${SALES_API}/customers/${String(id)}/contract/document/`, { signal }),
  });

export function useUploadScan(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, messages }: { file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('file', file);
      return uploadFile(
        `${SALES_API}/customers/${String(id)}/contract/scan/`,
        body,
        file,
        messages,
      );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: handoffQuery(id).queryKey }),
  });
}
