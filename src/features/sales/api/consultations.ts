import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

/** `day`: one chosen day (with `date`), its sessions and the contacts logged that day (S58). */
export type ConsultationRange = 'today' | 'week' | 'past' | 'all' | 'day';

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
  /** `day` only when a day was asked for. */
  counts: Record<Exclude<ConsultationRange, 'day'>, number> & { day?: number };
  /** Past sessions without a log, any range. */
  unlogged: number;
  types: { id: number; name: string }[];
  /** A manager's seller filter; empty for a seller. */
  sellers?: { id: number; name: string }[];
  /** With `range=day`. */
  day?: DayReport;
}

export type DayContactKind = 'call' | 'no_answer' | 'message' | 'meeting';

/** What one day held: sessions by consultation type, and the contacts logged that day. */
export interface DayReport {
  sessions: { type: string; count: number }[];
  kinds: { kind: DayContactKind; count: number }[];
  contacts: {
    id: number;
    customer: number;
    name: string;
    kind: DayContactKind;
    channel: 'whatsapp' | 'telegram' | 'sms' | null;
    at: string;
    author: string | null;
    text: string;
  }[];
  /** More contacts than were sent. */
  more: boolean;
}

/** The list's filters besides the range: the chosen day (`YYYY-MM-DD`) and a manager's seller. */
export interface ConsultationFilters {
  date?: string;
  seller?: number;
}

/** The seller's paid consultations (managers: everyone's), with counts per range (S19). */
function fetchConsultations(
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
  page: number,
  filters: ConsultationFilters,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ range, page: String(page) });
  if (type !== null) params.set('type', String(type));
  if (unlogged) params.set('unlogged', '1');
  if (filters.date) params.set('date', filters.date);
  if (filters.seller !== undefined) params.set('seller', String(filters.seller));
  return api<ConsultationsData>(`${SALES_API}/consultations/?${params.toString()}`, { signal });
}

export const consultationsQuery = (
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
  page: number,
  filters: ConsultationFilters = {},
) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'consultations', range, type, unlogged, page, filters],
    queryFn: ({ signal }) => fetchConsultations(range, type, unlogged, page, filters, signal),
    placeholderData: keepPreviousData,
  });
