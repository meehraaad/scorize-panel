import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Face } from '@/lib/face/api';
import { toValue } from '@/lib/calendar';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

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
}

/** How many of the seller's own tasks fall on a day (S50): only days with any. */
export interface CalendarTaskDay {
  /** `YYYY-MM-DD`. */
  day: string;
  /** Open follow-ups of mine due that day. */
  mine: number;
  /** Open requests from colleagues due that day. */
  requests: number;
  /** Of both, how many are closed. */
  done: number;
}

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

/** An in-person customer arrived at the office (S47). */
export function useMarkArrived() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ arrived_at: string }>(`${SALES_API}/consultations/${String(id)}/arrived/`, {
        method: 'POST',
      }),
    onSettled: () => client.invalidateQueries({ queryKey: CALENDAR_KEY }),
  });
}

export interface FollowUpChange {
  lead: number;
  /** ISO time. */
  at: string;
  /** What to do then; empty keeps a moved follow-up's text. */
  text?: string;
}

/**
 * Sets a lead's one follow-up from the calendar (a new one, or one dragged to another time) through
 * `leads/bulk/`. A moved call jumps there at once; the calendars and lists reload after.
 */
export function useSetFollowUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lead, at, text }: FollowUpChange) =>
      api(`${SALES_API}/leads/bulk/`, {
        method: 'POST',
        body: { ids: [lead], follow_up_at: at, ...(text ? { follow_up_text: text } : {}) },
      }),
    onMutate: async ({ lead, at }) => {
      await client.cancelQueries({ queryKey: CALENDAR_KEY });
      const before = client.getQueriesData<SellerCalendar>({ queryKey: CALENDAR_KEY });
      client.setQueriesData<SellerCalendar>(
        { queryKey: CALENDAR_KEY },
        (data) =>
          data && {
            ...data,
            calls: data.calls.map((call) =>
              call.lead === lead ? { ...call, follow_up_at: at } : call,
            ),
          },
      );
      return { before };
    },
    onError: (_error, _change, context) => {
      for (const [key, data] of context?.before ?? []) client.setQueryData(key, data);
    },
    onSettled: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}
