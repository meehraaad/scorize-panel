import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

export type ConsultationRange = 'today' | 'week' | 'past' | 'all';

export interface Consultation {
  id: number;
  customer: number;
  name: string;
  phone: string;
  /** ConsultationType. */
  type: { id: number; name: string };
  mode: 'online' | 'in_person';
  /** The session length; null when the consultation type has none. */
  minutes: number | null;
  starts_at: string;
  logged: boolean;
  meeting_url: string | null;
}

/** A page of the range (past: newest first, else soonest first), with the counts per range. */
export interface ConsultationsData extends Page<Consultation> {
  counts: Record<ConsultationRange, number>;
  /** Past sessions without a log, any range. */
  unlogged: number;
  types: { id: number; name: string }[];
}

/** The seller's paid consultations (managers: everyone's), with counts per range (S19). */
function fetchConsultations(
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
  page: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ range, page: String(page) });
  if (type !== null) params.set('type', String(type));
  if (unlogged) params.set('unlogged', '1');
  return api<ConsultationsData>(`${SALES_API}/consultations/?${params.toString()}`, { signal });
}

export const consultationsQuery = (
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
  page: number,
) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'consultations', range, type, unlogged, page],
    queryFn: ({ signal }) => fetchConsultations(range, type, unlogged, page, signal),
    placeholderData: keepPreviousData,
  });
