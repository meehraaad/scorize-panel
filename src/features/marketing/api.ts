import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import type { DayStatus } from '@/lib/attendance';
import type { Face } from '@/lib/face/api';
import type { TaskCalendarData } from '@/lib/tasks/calendar';
import type { StageColor } from './boardApi';

/**
 * The marketing panel: the team's day, the calendar and my own attendance (the board and the
 * manager's pages: `boardApi.ts`). Django: `api/marketing/v1/` (lang). Who: active staff who are
 * marketers (the marketing team, `apply.can_market`, superusers), as the old site's marketing
 * pages. Tasks are the shared API (`?panel=marketing`).
 */
export const MARKETING_API = '/marketing/v1';
export const MARKETING_KEY = ['marketing'] as const;
/** apply.can_market: a marketer outside the marketing team. */
export const MARKETING_PERMISSION = 'can_market';

export type { DayStatus };

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
  /** My open cards on the board, per stage (every stage, in order). */
  cards: { stage: number; name: string; color: StageColor; count: number }[];
  /** Of them, how many the manager sent back. */
  returned: number;
}

export type { CalendarTaskDay, CalendarTaskRow } from '@/lib/tasks/calendar';

export type MarketingEventKind = 'campaign_start' | 'campaign_end' | 'publish';

export interface MarketingEvent {
  id: string;
  kind: MarketingEventKind;
  /** `YYYY-MM-DD`. */
  day: string;
  at: string;
  title: string;
  /** `campaign_*`: the campaign. */
  campaign?: number;
  /** `publish`: the board's card, and whether it is mine. */
  card?: number;
  mine?: boolean;
}

export interface MarketingCalendar extends TaskCalendarData {
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

/** The month `shift` months from today's, for `attendanceQuery` (`lib/calendar`). */
export { monthRange } from '@/lib/calendar';
