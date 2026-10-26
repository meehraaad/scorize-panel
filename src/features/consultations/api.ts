import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import {
  CONSULTATIONS_KEY,
  consultationsQuery,
  splitSessions,
  type Consultation,
} from '@/lib/applicant/consultations';

export { consultationsQuery, splitSessions, type Consultation };

/**
 * Booked consultations (canvas V6 section 15): the list, and one session with the information the
 * consultant reads beforehand and its invoice. Any account (booking doesn't need a contract).
 * Shapes: docs/backend-changes.md H39–H41.
 */

export interface ConsultationInfo {
  university: string;
  major: string;
  degree: string;
  notes: string;
}

export interface ConsultationDetail extends Consultation {
  info: ConsultationInfo;
  invoice: { amount: number; paid_at: string | null; payment_id: number | null };
}

const BASE = '/applicant/v1/consultations';
const KEY = CONSULTATIONS_KEY;

/** One session; null when it isn't the user's (or doesn't exist). */
export const consultationQuery = (id: number) =>
  queryOptions({
    queryKey: [...KEY, id],
    queryFn: async ({ signal }): Promise<ConsultationDetail | null> => {
      try {
        return await api<ConsultationDetail>(`${BASE}/${String(id)}/`, { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });

export function useSaveConsultationInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (info: ConsultationInfo) =>
      api(`${BASE}/${String(id)}/info/`, { method: 'PUT', body: info }),
    // The services page lists sessions too.
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}
