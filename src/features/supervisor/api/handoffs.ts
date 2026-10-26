import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import { SUPERVISOR_API, SUPERVISOR_KEY } from './common';

/**
 * New cases waiting for a supervisor (docs/backend-changes.md SV18, SV19), for managers with
 * `can_assign_supervisor`. Assigning starts the case: the contract becomes active.
 */
export const ASSIGN_PERMISSION = 'can_assign_supervisor';

export interface HandoffCase {
  /** The applicant file. */
  case: number;
  name: string;
  phone: string | null;
  seller: string;
  approved_at: string | null;
  features: ('admission' | 'writing' | 'visa')[];
  countries: string[];
  degrees: Degree[];
  /** Toman. */
  amount: number;
  /** Ready to assign at `supervisor`: signed and prepaid. */
  state: 'signing' | 'payment' | 'supervisor';
  scans: { id: number; url: string; uploaded_at: string }[];
  prepayment: {
    payment_id: number;
    amount: number;
    status: 'unpaid' | 'review' | 'declined' | 'paid';
  } | null;
  /** SupportStaff id the server suggests (the contract's countries, fewest active cases). */
  suggested: number | null;
}

export interface HandoffSupervisor {
  id: number;
  name: string;
  /** Active cases. */
  active: number;
  countries: string[];
}

export interface HandoffsData {
  results: HandoffCase[];
  supervisors: HandoffSupervisor[];
}

export const handoffsQuery = queryOptions({
  queryKey: [...SUPERVISOR_KEY, 'handoffs'],
  queryFn: ({ signal }) => api<HandoffsData>(`${SUPERVISOR_API}/handoffs/`, { signal }),
});

export function useAssignSupervisor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, supervisor }: { id: number; supervisor: number }) =>
      api(`${SUPERVISOR_API}/handoffs/${String(id)}/`, { method: 'POST', body: { supervisor } }),
    onSuccess: () => client.invalidateQueries({ queryKey: SUPERVISOR_KEY }),
  });
}
