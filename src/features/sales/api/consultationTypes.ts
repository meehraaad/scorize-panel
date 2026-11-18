import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import type { Weekday } from '@/lib/sales/phoneCalls';

/**
 * The sales manager's consultation types (S81, lang `api/sales/v1/consultation_types.py`): price
 * and discount, sold or not, length, weekly times and closed days. Booking pages read the same
 * types, so a change shows there at once.
 */

export type ConsultationMode = 'online' | 'in_person';

/** One weekly row: from `start` to `end` (`HH:MM`, Tehran), `capacity` people at each time. */
export interface WeekRow {
  day: Weekday;
  start: string;
  end: string;
  capacity: number;
}

/** A closed day (`time` null) or one closed start time, from today on. */
export interface Closure {
  id: number;
  date: string;
  time: string | null;
  /** Seats taken away; null: all of them. */
  capacity: number | null;
}

export interface ConsultationTypeRow {
  id: number;
  title: string;
  description: string;
  mode: ConsultationMode;
  /** Offered on the site and to sellers. */
  active: boolean;
  /** Toman. */
  price: number;
  discounted_price: number | null;
  discount_until: string | null;
  /** The discount holds now (it has an end date in the future). */
  discount_on: boolean;
  /** Minutes of a session. */
  length: number;
  /** Minutes between start times; null: each weekly row is one time at its start. */
  slot_minutes: number | null;
  week: WeekRow[];
  closures: Closure[];
  /** Paid sessions from now on. */
  upcoming: number;
}

export interface ConsultationTypeInput {
  title?: string;
  description?: string;
  mode?: ConsultationMode;
  active?: boolean;
  price?: number;
  discounted_price?: number | null;
  discount_until?: string | null;
  length?: number;
  slot_minutes?: number | null;
  week?: WeekRow[];
}

export const BASE = `${SALES_API}/manager/consultation-types`;
export const KEY = [...SALES_KEY, 'manager', 'consultation-types'] as const;

export const consultationTypesQuery = queryOptions({
  queryKey: KEY,
  queryFn: ({ signal }) => api<{ types: ConsultationTypeRow[] }>(`${BASE}/`, { signal }),
});

const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
const timeOf = (minutes: number) =>
  [Math.floor(minutes / 60), minutes % 60].map((part) => String(part).padStart(2, '0')).join(':');

/**
 * The start times a weekly row offers, as Django cuts them (`course.functions.schedule_slots`):
 * without `slot_minutes` only its start; with it, one every `slot_minutes` whose session still ends
 * by the row's end.
 */
export function startsOf(row: Pick<WeekRow, 'start' | 'end'>, length: number, step: number | null) {
  if (!step) return [row.start];
  const starts: string[] = [];
  const end = minutesOf(row.end);
  for (let at = minutesOf(row.start); at + length <= end; at += step) starts.push(timeOf(at));
  return starts;
}

/** Rows of a day that overlap (Django refuses them). */
export function overlapping(rows: readonly WeekRow[]) {
  const sorted = [...rows].sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  return sorted.some((row, at) => {
    const before = sorted[at - 1];
    return before !== undefined && minutesOf(row.start) < minutesOf(before.end);
  });
}
