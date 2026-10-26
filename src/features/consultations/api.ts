import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
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

export interface SessionSummary {
  id: number;
  at: string;
  kind: string;
  customer_summary: string;
  reservation: number | null;
  authors: string[];
}

interface SessionSummaryPage {
  results: SessionSummary[];
  has_more: boolean;
}

/** Shared contact/session advice, including leads without a booking or a contract. */
export const sessionSummariesQuery = (reservation?: number) =>
  infiniteQueryOptions({
    queryKey: [...KEY, 'session-summaries', reservation ?? null],
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam !== null) params.set('before', String(pageParam));
      if (reservation !== undefined) params.set('reservation', String(reservation));
      return api<SessionSummaryPage>(`/applicant/v1/session-summaries/?${params.toString()}`, {
        signal,
      });
    },
    initialPageParam: null as number | null,
    getNextPageParam: (page) => (page.has_more ? page.results.at(-1)?.id : undefined),
    staleTime: 30_000,
  });
