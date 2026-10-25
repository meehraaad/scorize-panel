import { api } from '@/lib/api/client';
import {
  CONSULTATION_TYPES_API,
  MAX_PAGE_SIZE,
  STAFF_API,
  allPages,
  fullName,
  type DjangoConsultationType,
  type DjangoReservation,
  type Page,
} from '../djangoStaff';

export type ConsultationRange = 'today' | 'week' | 'past' | 'all';

export interface Consultation {
  id: number;
  customer: number;
  name: string;
  phone: string;
  /** ConsultationType. */
  type: { id: number; name: string };
  mode: 'online' | 'in_person';
  /** Null while Django doesn't send the type's length (ConsultationType.meeting_length). */
  minutes: number | null;
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

const RESERVATIONS = `${STAFF_API}/consultation-reservations`;
/** ConsultationType.Type: 1 in person, 2 online. */
const IN_PERSON = 1;
const DAY = 86_400_000;

/** `date` filters of each range (ConsultationReservationViewSet: date, with lookups). */
function rangeFilter(range: ConsultationRange): Record<string, string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = (time: number) => new Date(time).toISOString();
  switch (range) {
    case 'today':
      return { date__range: `${iso(start.getTime())},${iso(start.getTime() + DAY - 1)}` };
    case 'week':
      return { date__range: `${iso(start.getTime())},${iso(start.getTime() + 7 * DAY - 1)}` };
    case 'past':
      return { date__lt: iso(Date.now()) };
    case 'all':
      return {};
  }
}

/**
 * The seller's paid consultations from Django's ConsultationReservationViewSet (assigned to them;
 * managers see all) until S19 ships. "Logged" is Django's `is_called`: a ContactHistory exists.
 */
export async function fetchConsultations(
  range: ConsultationRange,
  type: number | null,
  unlogged: boolean,
  signal?: AbortSignal,
): Promise<ConsultationsData> {
  const query = (extra: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    if (type !== null) params.set('consultation_type', String(type));
    return params.toString();
  };
  const count = (extra: Record<string, string>) =>
    api<{ count: number }>(`${RESERVATIONS}/count/?${query(extra)}`, { signal }).then(
      (data) => data.count,
    );
  const notLogged = { contact_history__isnull: 'true', date__lt: new Date().toISOString() };
  const [page, types, today, week, past, all, waiting] = await Promise.all([
    api<Page<DjangoReservation>>(
      `${RESERVATIONS}/?${query({
        ...rangeFilter(range),
        ...(unlogged ? notLogged : {}),
        ordering: range === 'past' ? '-date' : 'date',
        page_size: String(MAX_PAGE_SIZE),
      })}`,
      { signal },
    ),
    allPages<DjangoConsultationType>(`${CONSULTATION_TYPES_API}/`, signal),
    count(rangeFilter('today')),
    count(rangeFilter('week')),
    count(rangeFilter('past')),
    count({}),
    count(notLogged),
  ]);
  return {
    counts: { today, week, past, all },
    unlogged: waiting,
    types: types.map((item) => ({ id: item.id, name: item.title })),
    results: page.results.map((item) => {
      const kind = types.find((entry) => entry.id === item.consultation_type);
      const user = item.invoice.payment.user;
      return {
        id: item.id,
        customer: user?.id ?? 0,
        name: user ? fullName(user) : '',
        phone: user?.phone_number ?? '',
        type: { id: item.consultation_type, name: kind?.title ?? '' },
        mode: kind?.type === IN_PERSON ? 'in_person' : 'online',
        minutes: null,
        starts_at: item.date,
        logged: item.is_called,
        meeting_url: null,
      };
    }),
  };
}
