import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { DayStatus } from '@/lib/attendance';
import { toValue } from '@/lib/calendar';

/**
 * The attendance section: the office terminal's punches turned into daily and monthly numbers, and
 * the mapping of the terminal's user numbers to staff. Django: `api/attendance/v1/`
 * (lang `attendance/`, docs/attendance.md). Key: `manage_attendance`.
 *
 * The terminal records no direction: a day's first punch is the check-in, the last one the
 * check-out (a single punch has no check-out).
 */
export const ATTENDANCE_PERMISSION = 'manage_attendance';
export const ATTENDANCE_API = '/attendance/v1';
export const ATTENDANCE_KEY = ['attendance'] as const;

export type { DayStatus };

export interface DayRow {
  /** `YYYY-MM-DD`. */
  date: string;
  /** The panel user, or null for a terminal number nobody mapped yet. */
  employee_id: number | null;
  enroll_id: number | null;
  name: string;
  /** ISO times in Iran time. */
  check_in: string | null;
  check_out: string | null;
  punches: number;
  worked_seconds: number;
  late_seconds: number;
  status: DayStatus;
}

export interface PersonTotals {
  employee_id: number | null;
  enroll_id: number | null;
  name: string;
  days_present: number;
  worked_seconds: number;
  late_days: number;
  late_seconds: number;
  absent_days: number;
  missing_check_out_days: number;
}

export interface Report<T> {
  /** The usual workday start (`HH:MM`): when the phone line opens on most days (office phone hours). */
  start: string | null;
  /** Python weekdays with no work (Friday, Saturday). */
  weekend: number[];
  results: T[];
}

export interface Device {
  id: number;
  sn: string;
  name: string;
  model: string;
  firmware: string;
  last_seen_at: string | null;
  last_ip: string | null;
  is_active: boolean;
}

export interface Employee {
  id: number;
  name: string;
}

export interface Enrollment {
  id: number;
  device: number;
  enroll_id: number;
  /** As entered on the terminal; empty until the names are read. */
  name: string;
  employee: Employee | null;
}

/** A range of days (`YYYY-MM-DD`), for one person (`employee` or an unmapped `enroll`) or everyone. */
export interface Range {
  from: string;
  to: string;
  employee?: number | null;
  enroll?: number | null;
}

export function paramsOf({ from, to, employee, enroll }: Range) {
  const params = new URLSearchParams({ from, to });
  if (employee) params.set('employee', String(employee));
  if (enroll) params.set('enroll_id', String(enroll));
  return params.toString();
}

export const dailyQuery = (range: Range) =>
  queryOptions({
    queryKey: [...ATTENDANCE_KEY, 'daily', range],
    queryFn: ({ signal }) =>
      api<Report<DayRow>>(`${ATTENDANCE_API}/daily/?${paramsOf(range)}`, { signal }),
  });

export const summaryQuery = (range: Range) =>
  queryOptions({
    queryKey: [...ATTENDANCE_KEY, 'summary', range],
    queryFn: ({ signal }) =>
      api<Report<PersonTotals>>(`${ATTENDANCE_API}/summary/?${paramsOf(range)}`, { signal }),
  });

export const enrollmentsQuery = queryOptions({
  queryKey: [...ATTENDANCE_KEY, 'enrollments'],
  queryFn: ({ signal }) =>
    api<{ results: Enrollment[] }>(`${ATTENDANCE_API}/enrollments/`, { signal }),
});

export const peopleQuery = queryOptions({
  queryKey: [...ATTENDANCE_KEY, 'people'],
  queryFn: ({ signal }) => api<{ results: Employee[] }>(`${ATTENDANCE_API}/people/`, { signal }),
});

export const devicesQuery = queryOptions({
  queryKey: [...ATTENDANCE_KEY, 'devices'],
  queryFn: ({ signal }) => api<{ results: Device[] }>(`${ATTENDANCE_API}/devices/`, { signal }),
});

/** Python's names of the days, Saturday first (lang `api/sales/v1/calls/hours.py`). */
export type Weekday = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

/**
 * The week the reports count: each day's start (`HH:MM`, null: a day off), read from the office
 * phone hours the sales manager keeps; `saved` false: nobody saved them yet (the PBX's own hours).
 */
export interface Schedule {
  saved: boolean;
  week: { day: Weekday; start: string | null }[];
  /** Coming closed days, `YYYY-MM-DD`. */
  closed_days: string[];
  closed_today: boolean;
  /** Coming in within this many minutes of the start is on time. */
  grace_minutes: number;
}

export const scheduleQuery = queryOptions({
  queryKey: [...ATTENDANCE_KEY, 'schedule'],
  queryFn: ({ signal }) => api<Schedule>(`${ATTENDANCE_API}/schedule/`, { signal }),
});

/** The sales manager's key (`features/sales/api/manager.ts`): they edit the office phone hours. */
export const PHONE_HOURS_PERMISSION = 'can_assign_to_seller';
/** Where the phone hours are edited (the sales panel's manager area). */
export const PHONE_HOURS_PATH = '/sales/manager/phone/hours';

/** The attendance section's pages, inside the HR panel (features can't import panels). */
export const attendancePath = (to = '') => (to ? `/hr/attendance/${to}` : '/hr/attendance');

/** Today as `YYYY-MM-DD`: the daily page opens on it. */
export const todayValue = () => toValue(new Date(), false);

/** The first and last day of the calendar month `shift` months from today's (`lib/calendar`). */
export { monthRange } from '@/lib/calendar';
