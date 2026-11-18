import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { fromCalendar, monthLength, toCalendar, toValue, type CalendarKind } from '@/lib/calendar';
import type { Face } from '@/lib/face/api';

/**
 * The marketing panel, phase 1: the team's day, the calendar and my own attendance. Django:
 * `api/marketing/v1/` (lang). Who: active staff who are marketers (the marketing team,
 * `apply.can_market`, superusers), as the old site's marketing pages. Tasks are the shared API
 * (`?panel=marketing`).
 */
export const MARKETING_API = '/marketing/v1';
export const MARKETING_KEY = ['marketing'] as const;
/** apply.can_market: a marketer outside the marketing team. */
export const MARKETING_PERMISSION = 'can_market';

/** A day at the office terminal; `pending`: today, not in yet. */
export type DayStatus = 'present' | 'late' | 'absent' | 'pending';

export interface AttendanceDay {
  /** `YYYY-MM-DD`. */
  day: string;
  status: DayStatus;
  check_in: string | null;
  check_out: string | null;
  worked_seconds: number;
  late_seconds: number;
}

export interface TeamMember {
  /** SupportStaff id. */
  id: number;
  name: string;
  face: Face | null;
  /** The logged-in staff member. */
  me: boolean;
  /** Null: no number on the attendance terminal, so nothing is known. */
  attendance: AttendanceDay | null;
}

export interface RunningCampaign {
  id: number;
  title: string;
  start: string;
  /** Null: no end set. */
  end: string | null;
}

export interface MarketingToday {
  /** My attendance today; null without a number on the terminal. */
  me: AttendanceDay | null;
  team: TeamMember[];
  /** Running now, ending soonest first (a few). */
  campaigns: RunningCampaign[];
}

/** My task on the calendar (the sales calendar's shape, lang `api/sales/v1/calendar.py` seller_tasks). */
export interface CalendarTaskRow {
  id: number;
  kind: 'mine' | 'request';
  text: string;
  due_at: string;
  /** False: due some time that day, no hour; it shows on the day row only. */
  timed: boolean;
  done: boolean;
  customer: number | null;
  name: string;
}

/** How many of my tasks fall on a day: only days with any. */
export interface CalendarTaskDay {
  day: string;
  mine: number;
  requests: number;
  done: number;
}

export type MarketingEventKind = 'campaign_start' | 'campaign_end';

export interface MarketingEvent {
  id: string;
  kind: MarketingEventKind;
  /** `YYYY-MM-DD`. */
  day: string;
  at: string;
  title: string;
  campaign: number;
}

export interface MarketingCalendar {
  tasks: CalendarTaskDay[];
  task_rows: CalendarTaskRow[];
  events: MarketingEvent[];
}

export interface AttendanceTotals {
  days_present: number;
  worked_seconds: number;
  late_days: number;
  late_seconds: number;
  absent_days: number;
  missing_check_out_days: number;
}

export interface MyAttendance {
  /** False: I have no number on the terminal. */
  device: boolean;
  days: AttendanceDay[];
  totals: AttendanceTotals;
}

export interface Range {
  from: string;
  to: string;
}

export const todayQuery = queryOptions({
  queryKey: [...MARKETING_KEY, 'today'],
  queryFn: ({ signal }) => api<MarketingToday>(`${MARKETING_API}/today/`, { signal }),
});

/** The week starting on `week` (its 7 days). */
export const calendarQuery = (week: Date) => {
  const from = toValue(week, false);
  const to = toValue(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 6), false);
  return queryOptions({
    queryKey: [...MARKETING_KEY, 'calendar', from],
    queryFn: ({ signal }) =>
      api<MarketingCalendar>(`${MARKETING_API}/calendar/?from=${from}&to=${to}`, { signal }),
  });
};

export const attendanceQuery = ({ from, to }: Range) =>
  queryOptions({
    queryKey: [...MARKETING_KEY, 'attendance', from, to],
    queryFn: ({ signal }) =>
      api<MyAttendance>(`${MARKETING_API}/attendance/?from=${from}&to=${to}`, { signal }),
  });

/** The first and last day of the calendar month `shift` months from today's (Jalali in Persian). */
export function monthRange(kind: CalendarKind, shift = 0): Range & { year: number; month: number } {
  const today = toCalendar(new Date(), kind);
  const index = today.year * 12 + (today.month - 1) + shift;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = (n: number) => toValue(fromCalendar({ year, month, day: n }, kind), false);
  return { year, month, from: day(1), to: day(monthLength(year, month, kind)) };
}
