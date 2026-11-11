import { http, HttpResponse } from 'msw';
import type { DayRow, Device, Employee, Enrollment, PersonTotals } from '@/features/attendance/api';
import { forbidden, notFound, storage } from './session';

/**
 * Fake attendance section (lang `api/attendance/v1/`): two staff members mapped to terminal numbers
 * and a guest card nobody is mapped to. Amir (6, a superuser) holds the key; nobody else does.
 * Days are made up for whatever range is asked: Sunday to Thursday, Ali on time, Maryam late.
 */

const API = '/api/attendance/v1';
const SUPERUSER = 6;
const ALI: Employee = { id: 701, name: 'علی رضایی' };
const MARYAM: Employee = { id: 702, name: 'مریم کریمی' };
const START = '09:00';
const WEEKEND = [4, 5]; // Python weekdays: Friday, Saturday

const device = (): Device => ({
  id: 1,
  sn: 'ZYSD28049554',
  name: 'دفتر',
  model: 'S62',
  firmware: 'S63FP_V283',
  last_seen_at: new Date().toISOString(),
  last_ip: '192.168.2.17',
  is_active: true,
});

const enrollments = (): Enrollment[] => [
  { id: 1, device: 1, enroll_id: 10, name: 'ali', employee: ALI },
  { id: 2, device: 1, enroll_id: 11, name: 'maryam', employee: MARYAM },
  { id: 3, device: 1, enroll_id: 77, name: '', employee: null },
];

let rows = enrollments();
let syncs = 0;
export const attendanceSyncCount = () => syncs;

export function resetAttendanceMocks() {
  rows = enrollments();
  syncs = 0;
}

const allowed = () => storage.get() === SUPERUSER;

/** `YYYY-MM-DD` days from `from` to `to`, at most 62. */
function daysOf(from: string, to: string) {
  const days: string[] = [];
  const day = new Date(`${from}T12:00:00Z`);
  const last = new Date(`${to}T12:00:00Z`);
  while (day <= last && days.length < 62) {
    days.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return days;
}

const isWorkday = (date: string) => {
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Python's Monday = 0
  return !WEEKEND.includes(weekday);
};

const at = (date: string, clock: string) => `${date}T${clock}:00+03:30`;

function dayRows(date: string, first: boolean): DayRow[] {
  const out: DayRow[] = [];
  if (isWorkday(date)) {
    out.push(
      {
        date,
        employee_id: ALI.id,
        enroll_id: null,
        name: ALI.name,
        check_in: at(date, '08:50'),
        check_out: at(date, '17:05'),
        punches: 2,
        worked_seconds: 8 * 3600 + 15 * 60,
        late_seconds: 0,
        status: 'present',
      },
      {
        date,
        employee_id: MARYAM.id,
        enroll_id: null,
        name: MARYAM.name,
        check_in: at(date, '09:20'),
        check_out: at(date, '17:00'),
        punches: 2,
        worked_seconds: 7 * 3600 + 40 * 60,
        late_seconds: 20 * 60,
        status: 'late',
      },
    );
  }
  if (first)
    out.push({
      date,
      employee_id: null,
      enroll_id: 77,
      name: '',
      check_in: at(date, '10:00'),
      check_out: null,
      punches: 1,
      worked_seconds: 0,
      late_seconds: 3600,
      status: 'late',
    });
  return out;
}

const totals = (): PersonTotals[] => [
  {
    employee_id: ALI.id,
    enroll_id: null,
    name: ALI.name,
    days_present: 20,
    worked_seconds: 20 * (8 * 3600 + 15 * 60),
    late_days: 0,
    late_seconds: 0,
    absent_days: 1,
    missing_check_out_days: 0,
  },
  {
    employee_id: MARYAM.id,
    enroll_id: null,
    name: MARYAM.name,
    days_present: 21,
    worked_seconds: 21 * (7 * 3600 + 40 * 60),
    late_days: 6,
    late_seconds: 6 * 20 * 60,
    absent_days: 0,
    missing_check_out_days: 1,
  },
  {
    employee_id: null,
    enroll_id: 77,
    name: '',
    days_present: 1,
    worked_seconds: 0,
    late_days: 1,
    late_seconds: 3600,
    absent_days: 0,
    missing_check_out_days: 1,
  },
];

export const attendanceHandlers = [
  http.get(`${API}/daily/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const query = new URL(request.url).searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const days = daysOf(query.get('from') ?? today, query.get('to') ?? today);
    const employee = Number(query.get('employee')) || null;
    const enroll = Number(query.get('enroll_id')) || null;
    const results = days
      .flatMap((date, index) => dayRows(date, index === 0))
      .filter(
        (row) =>
          (!employee || row.employee_id === employee) && (!enroll || row.enroll_id === enroll),
      );
    return HttpResponse.json({ start: START, weekend: WEEKEND, results });
  }),

  http.get(`${API}/summary/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const employee = Number(new URL(request.url).searchParams.get('employee')) || null;
    return HttpResponse.json({
      start: START,
      weekend: WEEKEND,
      results: totals().filter((row) => !employee || row.employee_id === employee),
    });
  }),

  http.get(`${API}/devices/`, () =>
    allowed() ? HttpResponse.json({ results: [device()] }) : forbidden(),
  ),
  http.get(`${API}/people/`, () =>
    allowed() ? HttpResponse.json({ results: [ALI, MARYAM] }) : forbidden(),
  ),
  http.get(`${API}/enrollments/`, () =>
    allowed() ? HttpResponse.json({ results: rows }) : forbidden(),
  ),

  http.patch(`${API}/enrollments/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = rows.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    const body = (await request.json()) as { employee: number | null };
    row.employee = [ALI, MARYAM].find((person) => person.id === body.employee) ?? null;
    return HttpResponse.json(row);
  }),

  http.post(`${API}/sync/`, () => {
    if (!allowed()) return forbidden();
    syncs += 1;
    return HttpResponse.json({ id: syncs, status: 'pending' }, { status: 202 });
  }),
];
