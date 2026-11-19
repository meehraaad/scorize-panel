import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Face } from '@/lib/face/api';
import { toValue } from '@/lib/calendar';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import type { CalendarTaskDay, CalendarTaskRow } from '@/lib/tasks/calendar';

/** A consultation type on the seller's calendar: its colour and how it is held. */
export interface CalendarType {
  id: number;
  name: string;
  mode: 'online' | 'in_person';
  /** Google Calendar colour id (1–11); null: the brand's. */
  color: string | null;
}

export interface CalendarConsultation {
  id: number;
  customer: number;
  name: string;
  phone: string;
  type: number;
  mode: 'online' | 'in_person';
  minutes: number | null;
  starts_at: string;
  /** The session has its contact log. */
  logged: boolean;
  /** The customer filled the tablet form. */
  form: boolean;
  /** In person: when the customer arrived; null before. */
  arrived_at: string | null;
  /** Assigned to this seller (a manager also sees everyone else's). */
  mine: boolean;
  /** Who it is assigned to; null while nobody is. */
  seller: string | null;
  /** Their staff id, for a manager's assign menu; absent from an older Django. */
  seller_id?: number | null;
  /** The emoji and color the team gave the customer (S66); null: none. */
  face?: Face | null;
}

/** An open lead with a follow-up time in the range. */
export interface CalendarCall {
  lead: number;
  customer: number;
  name: string;
  phone: string;
  reason: string;
  follow_up_at: string;
  /** A sales manager's lists: whose it is ('' while nobody has it); null or absent for a seller. */
  seller?: string | null;
  /** The emoji and color the team gave the customer (S66); null: none. */
  face?: Face | null;
  /** False: a follow-up for that day with no hour (counted on the day row, not drawn at 23:59). */
  timed?: boolean;
  /** How long the call is on the calendar (15 unless its end was changed); absent before Django sends it. */
  minutes?: number;
}

export type { CalendarTaskDay, CalendarTaskRow };

/** An in-person meeting at the office (S75): the seller's own, one they were asked to join, or (a manager) all. */
export interface CalendarVisit {
  id: number;
  customer: number;
  name: string;
  phone: string;
  starts_at: string;
  minutes: number;
  room: string | null;
  note: string;
  seller: string | null;
  mine: boolean;
  colleague: string | null;
}

export interface SellerCalendar {
  types: CalendarType[];
  consultations: CalendarConsultation[];
  calls: CalendarCall[];
  /** Absent from a Django before S75. */
  visits?: CalendarVisit[];
  tasks: CalendarTaskDay[];
  /** Absent from an older Django. */
  task_rows?: CalendarTaskRow[];
  /** A sales manager's calendar: who a consultation can be given to; empty for a seller. */
  sellers?: { id: number; name: string }[];
}

export const CALENDAR_KEY = [...SALES_KEY, 'calendar'] as const;

/** A week of the seller's consultations, timed follow-ups (S47) and tasks per day (S50). */
export const sellerCalendarQuery = (week: Date) => {
  const from = toValue(week, false);
  const to = toValue(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 6), false);
  return queryOptions({
    queryKey: [...CALENDAR_KEY, from],
    queryFn: ({ signal }) =>
      api<SellerCalendar>(
        `${SALES_API}/consultations/calendar/?${new URLSearchParams({ from, to }).toString()}`,
        { signal },
      ),
    staleTime: 60_000,
  });
};

/** One day of the seller's calendar (Today's plan for another day). */
export const sellerDayQuery = (day: Date) => {
  const value = toValue(day, false);
  return queryOptions({
    queryKey: [...CALENDAR_KEY, 'day', value],
    queryFn: ({ signal }) =>
      api<SellerCalendar>(
        `${SALES_API}/consultations/calendar/?${new URLSearchParams({ from: value, to: value }).toString()}`,
        { signal },
      ),
    staleTime: 60_000,
  });
};

export interface FollowUpChange {
  lead: number;
  /** ISO time; null with `on`. */
  at: string | null;
  /** A day with no hour (`YYYY-MM-DD`), instead of `at`. */
  on?: string | null | undefined;
  /** What to do then; empty keeps a moved follow-up's text. */
  text?: string;
  /** How long the call is (its end); not sent, a moved follow-up keeps its own. */
  minutes?: number;
}
