import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import type { Page } from '@/lib/api/page';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

/**
 * `day`: one chosen day (with `date`), its sessions and the contacts logged that day (S59).
 * `span`: the days from `from` to `to` (both included, either may be left open).
 */
export type ConsultationRange = 'today' | 'week' | 'past' | 'all' | 'day' | 'span';

/** A manager's status filter: still ahead, held with a log, held without one, came to the office. */
export type ConsultationStatusFilter = 'upcoming' | 'done' | 'unlogged' | 'arrived';
export const CONSULTATION_STATUS_FILTERS: readonly ConsultationStatusFilter[] = [
  'upcoming',
  'done',
  'unlogged',
  'arrived',
];

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
  /** Who holds it; null while nobody does. Absent from an older Django. */
  seller?: string | null;
  seller_id?: number | null;
  /** In person: when the customer came to the office. Absent from an older Django. */
  arrived_at?: string | null;
}

/** A manager's cards over every paid session, whatever the list's filters. */
export interface ConsultationSummary {
  today: number;
  tomorrow: number;
  week: number;
  /** Upcoming, nobody holds them. */
  unassigned: number;
  /** Past, without a log. */
  unlogged: number;
}

/** A page of the range (past: newest first, else soonest first), with the counts per range. */
export interface ConsultationsData extends Page<Consultation> {
  /** `day` only when a day was asked for. */
  counts: Record<Exclude<ConsultationRange, 'day' | 'span'>, number> & { day?: number };
  /** Managers only. */
  summary?: ConsultationSummary;
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
  /** A manager's seller, or `none`: those nobody holds yet. */
  seller?: number | 'none';
  /** With `span`: first and last day, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  mode?: 'online' | 'in_person';
  status?: ConsultationStatusFilter;
  /** A name, email or phone. */
  q?: string;
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
  for (const key of ['from', 'to', 'mode', 'status', 'q'] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
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

/**
 * The sales manager's consultations page (`manager/consultations`): a view (a few days, or those
 * that need the manager) and filters, kept in the address so a link opens the same list.
 */
export type ManagerConsultationView =
  'today' | 'tomorrow' | 'week' | 'unassigned' | 'unlogged' | 'past' | 'all' | 'span';
export const MANAGER_CONSULTATION_VIEWS: readonly ManagerConsultationView[] = [
  'today',
  'tomorrow',
  'week',
  'unassigned',
  'unlogged',
  'past',
  'all',
  'span',
];
/** Opens on the next seven days: today's sessions first, the week's load at a glance. */
export const DEFAULT_MANAGER_VIEW: ManagerConsultationView = 'week';

export const managerViewOf = (value: string | null): ManagerConsultationView =>
  MANAGER_CONSULTATION_VIEWS.find((view) => view === value) ?? DEFAULT_MANAGER_VIEW;

const dayValue = (shift: number) => {
  const day = new Date();
  day.setDate(day.getDate() + shift);
  return toValue(day, false);
};

/** The list the manager's page reads for its address (`search`) and what is typed in its search box. */
export function managerConsultationsQuery(search: URLSearchParams, typed = '') {
  const view = managerViewOf(search.get('view'));
  const type = Number(search.get('type')) || null;
  const page = Math.max(1, Number(search.get('page')) || 1);
  const filters: ConsultationFilters = {};
  const mode = search.get('mode');
  if (mode === 'online' || mode === 'in_person') filters.mode = mode;
  const seller = search.get('seller');
  if (view !== 'unassigned' && seller)
    if (seller === 'none') filters.seller = 'none';
    else if (Number(seller)) filters.seller = Number(seller);
  const status = CONSULTATION_STATUS_FILTERS.find((value) => value === search.get('status'));
  if (status && view !== 'unassigned' && view !== 'unlogged') filters.status = status;
  if (typed.trim()) filters.q = typed.trim();

  let range: ConsultationRange = view === 'span' || view === 'tomorrow' ? 'span' : 'all';
  if (view === 'today' || view === 'week' || view === 'past' || view === 'all') range = view;
  if (view === 'tomorrow') filters.from = filters.to = dayValue(1);
  if (view === 'unassigned') Object.assign(filters, { seller: 'none', status: 'upcoming' });
  if (view === 'unlogged') {
    range = 'past';
    filters.status = 'unlogged';
  }
  if (view === 'span') {
    const from = search.get('from');
    const to = search.get('to');
    if (from) filters.from = from;
    if (to) filters.to = to;
  }
  return consultationsQuery(range, type, false, page, filters);
}
