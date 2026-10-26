import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';
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
