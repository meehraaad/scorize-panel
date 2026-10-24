import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
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
  minutes: number;
  starts_at: string;
  logged: boolean;
  meeting_url: string | null;
}

export interface ConsultationsData {
  counts: Record<ConsultationRange, number>;
  /** Past sessions without a log, any range. */
  unlogged: number;
  types: { id: number; name: string }[];
  results: Consultation[];
}

export const consultationsQuery = (
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'consultations', range, type, unlogged],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ range });
      if (type !== null) params.set('type', String(type));
      if (unlogged) params.set('unlogged', '1');
      return api<ConsultationsData>(`${SALES_API}/consultations/?${params.toString()}`, { signal });
    },
    placeholderData: keepPreviousData,
  });
