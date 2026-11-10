import { http, HttpResponse } from 'msw';
import type { OfficeHoursInput, OfficeHoursState, PhoneSnapshot } from '@/lib/sales/phoneCalls';
import { forbidden, storage } from './session';

let snapshots = new Map<number, PhoneSnapshot>();

const PBX_HOURS = (open: string, close: string) =>
  (['sun', 'mon', 'tue', 'wed', 'thu'] as const).map((day) => ({ day, open, close }));
const freshHours = (): OfficeHoursState => ({
  saved: false,
  week: PBX_HOURS('10:30', '19:00'),
  direct: PBX_HOURS('11:30', '13:00'),
  closed_days: [],
  force: '',
  open_now: true,
  updated_at: null,
  updated_by: null,
});
let hours = freshHours();

export function setPhoneSnapshot(owner: number, snapshot: PhoneSnapshot) {
  snapshots.set(owner, snapshot);
}

export function resetPhoneMocks() {
  snapshots = new Map();
  hours = freshHours();
}

/** Django's checks in OfficeHoursSerializer, with its messages. */
function hoursErrors(body: OfficeHoursInput) {
  const errors: Record<string, string[]> = {};
  if (body.week.length === 0) errors.week = ['Open the line on at least one day.'];
  for (const key of ['week', 'direct'] as const) {
    if (body[key].some((row) => row.close <= row.open))
      errors[key] = ['Closing time must be after opening time.'];
  }
  return errors;
}

export const phoneCallHandlers = [
  // Office hours: sales managers only (Reza, user 4), like IsSalesManager.
  http.get('/api/sales/v1/calls/hours/', () =>
    storage.get() === 4 ? HttpResponse.json(hours) : forbidden(),
  ),
  http.put('/api/sales/v1/calls/hours/', async ({ request }) => {
    if (storage.get() !== 4) return forbidden();
    const body = (await request.json()) as OfficeHoursInput;
    const errors = hoursErrors(body);
    if (Object.keys(errors).length > 0) return HttpResponse.json(errors, { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    hours = {
      ...body,
      closed_days: [...new Set(body.closed_days.filter((day) => day >= today))].sort(),
      saved: true,
      open_now: body.force === '' ? hours.open_now : body.force === 'open',
      updated_at: new Date().toISOString(),
      updated_by: 'رضا کامرانی',
    };
    return HttpResponse.json(hours);
  }),
  http.get('/api/sales/v1/calls/', () => {
    const owner = storage.get();
    if (owner !== 3 && owner !== 4) return forbidden();
    return HttpResponse.json(
      snapshots.get(owner) ?? {
        available: false,
        enabled: false,
        connected: false,
        extension: null,
        server_time: new Date().toISOString(),
        calls: [],
      },
    );
  }),
  http.get('/api/sales/v1/calls/mobile/', () => {
    const owner = storage.get();
    if (owner !== 3 && owner !== 4) return forbidden();
    return HttpResponse.json({
      available: false,
      status: 'none',
      extension: null,
      password: null,
      domain: null,
      server: null,
    });
  }),
];
