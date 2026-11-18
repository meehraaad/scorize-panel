import { http, HttpResponse } from 'msw';
import type {
  AttendanceDay,
  MarketingCalendar,
  MarketingToday,
  MyAttendance,
} from '@/features/marketing/api';
import { forbidden, storage } from './session';

/**
 * Fake marketing panel (lang `api/marketing/v1/`): Elham (7, marketing team) came in at 08:55 today,
 * Mina is late, Pooya has no number on the terminal; the Canada webinar is running and starts a
 * new round today. Amir (6, a superuser) gets in too. Same shapes as Django.
 */

const API = '/api/marketing/v1';
const MARKETERS = new Set([6, 7]);
const allowed = () => MARKETERS.has(storage.get() ?? 0);

const pad = (n: number) => String(n).padStart(2, '0');
const dayValue = (date: Date) =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const at = (day: string, hour: number, minute = 0) => `${day}T${pad(hour)}:${pad(minute)}:00+03:30`;
const todayValue = () => dayValue(new Date());

const present = (day: string, minute = 55): AttendanceDay => ({
  day,
  status: 'present',
  check_in: at(day, 8, minute),
  check_out: day === todayValue() ? null : at(day, 17, 5),
  worked_seconds: day === todayValue() ? 0 : 8 * 3600 + 10 * 60,
  late_seconds: 0,
});

function today(): MarketingToday {
  const day = todayValue();
  return {
    me: present(day),
    team: [
      { id: 11, name: 'الهام نوری', face: null, me: true, attendance: present(day) },
      {
        id: 12,
        name: 'مینا صادقی',
        face: null,
        me: false,
        attendance: {
          day,
          status: 'late',
          check_in: at(day, 9, 41),
          check_out: null,
          worked_seconds: 0,
          late_seconds: 41 * 60,
        },
      },
      { id: 13, name: 'پویا فرهادی', face: null, me: false, attendance: null },
    ],
    campaigns: [
      {
        id: 31,
        title: 'وبینار اپلای کانادا ۲۰۲۷',
        start: at(day, 18),
        end: at(dayValue(new Date(Date.now() + 9 * 86_400_000)), 18),
      },
    ],
  };
}

function calendar(from: string, to: string): MarketingCalendar {
  const day = todayValue();
  const inRange = from <= day && day <= to;
  return {
    tasks: inRange ? [{ day, mine: 1, requests: 0, done: 0 }] : [],
    task_rows: inRange
      ? [
          {
            id: 711,
            kind: 'mine',
            text: 'کپشن و هشتگ ریلز آلمان',
            due_at: at(day, 10, 30),
            timed: true,
            done: false,
            customer: null,
            name: '',
          },
        ]
      : [],
    events: inRange
      ? [
          {
            id: 'campaign_start-31',
            kind: 'campaign_start',
            day,
            at: at(day, 18),
            title: 'وبینار اپلای کانادا ۲۰۲۷',
            campaign: 31,
          },
        ]
      : [],
  };
}

/** Every day of the range up to today: present, the 3rd late, the 5th absent (days off aside). */
function attendance(from: string, to: string): MyAttendance {
  const days: AttendanceDay[] = [];
  const last = to < todayValue() ? to : todayValue();
  for (let date = new Date(`${from}T12:00:00`); dayValue(date) <= last;) {
    const day = dayValue(date);
    const index = days.length + 1;
    if (date.getDay() !== 5)
      days.push(
        index === 3
          ? {
              day,
              status: 'late',
              check_in: at(day, 9, 20),
              check_out: at(day, 17, 30),
              worked_seconds: 8 * 3600 + 10 * 60,
              late_seconds: 20 * 60,
            }
          : index === 5
            ? {
                day,
                status: 'absent',
                check_in: null,
                check_out: null,
                worked_seconds: 0,
                late_seconds: 0,
              }
            : present(day),
      );
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12);
  }
  const counted = days.filter((day) => day.status === 'present' || day.status === 'late');
  return {
    device: true,
    days,
    totals: {
      days_present: counted.length,
      worked_seconds: counted.reduce((sum, day) => sum + day.worked_seconds, 0),
      late_days: days.filter((day) => day.status === 'late').length,
      late_seconds: days.reduce((sum, day) => sum + day.late_seconds, 0),
      absent_days: days.filter((day) => day.status === 'absent').length,
      missing_check_out_days: counted.filter((day) => day.check_out === null).length,
    },
  };
}

const range = (request: Request) => {
  const params = new URL(request.url).searchParams;
  return { from: params.get('from') ?? '', to: params.get('to') ?? '' };
};
const invalid = () =>
  HttpResponse.json({ to: ['The last day is before the first.'] }, { status: 400 });

export const marketingHandlers = [
  http.get(`${API}/today/`, () => (allowed() ? HttpResponse.json(today()) : forbidden())),
  http.get(`${API}/calendar/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const { from, to } = range(request);
    return from && to && from <= to ? HttpResponse.json(calendar(from, to)) : invalid();
  }),
  http.get(`${API}/attendance/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const { from, to } = range(request);
    return from && to && from <= to ? HttpResponse.json(attendance(from, to)) : invalid();
  }),
];
