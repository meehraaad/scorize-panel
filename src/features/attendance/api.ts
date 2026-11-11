import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { fromCalendar, monthLength, toCalendar, toValue, type CalendarKind } from '@/lib/calendar';

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

export type DayStatus = 'present' | 'late' | 'absent' | 'pending';

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
  /** The workday start the late count uses (`HH:MM`). */
  start: string;
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

/** Today as `YYYY-MM-DD`: the daily page opens on it. */
export const todayValue = () => toValue(new Date(), false);

/** The first and last day of the calendar month `shift` months from today's (Jalali in Persian). */
export function monthRange(kind: CalendarKind, shift = 0): Range {
  const today = toCalendar(new Date(), kind);
  const index = today.year * 12 + (today.month - 1) + shift;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = (n: number) => toValue(fromCalendar({ year, month, day: n }, kind), false);
  return { from: day(1), to: day(monthLength(year, month, kind)) };
}
