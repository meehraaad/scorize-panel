import { http, HttpResponse } from 'msw';
import type {
  ConsultationTypeInput,
  ConsultationTypeRow,
  WeekRow,
} from '@/features/sales/api/consultationTypes';
import { overlapping } from '@/features/sales/api/consultationTypes';
import { forbidden, notFound, storage } from './session';

/**
 * The sales manager's consultation types (S81) as api/sales/v1/consultation_types.py answers them:
 * the list, a new type, changes (`week` replaces the rows), and closed days or times.
 */

const BASE = '/api/sales/v1/manager';
const MANAGERS = new Set([4]);
const manager = () => MANAGERS.has(storage.get() ?? 0);

const weekdays = (days: WeekRow['day'][], start: string, end: string, capacity = 2): WeekRow[] =>
  days.map((day) => ({ day, start, end, capacity }));

const fresh = (): { types: ConsultationTypeRow[]; next: number; nextClosure: number } => ({
  types: [
    {
      id: 1,
      title: 'مشاوره تحصیلی دانشگاهی حضوری',
      description: 'یک ساعت با مشاور ارشد در دفتر.',
      mode: 'in_person',
      active: true,
      price: 1_500_000,
      discounted_price: null,
      discount_until: null,
      discount_on: false,
      length: 60,
      slot_minutes: 60,
      week: weekdays(['sat', 'sun', 'mon', 'tue', 'wed'], '10:00', '17:00'),
      closures: [],
      upcoming: 4,
    },
    {
      id: 2,
      title: 'مشاوره تحصیلی دانشگاهی غیر حضوری',
      description: '',
      mode: 'online',
      active: true,
      price: 1_200_000,
      discounted_price: 900_000,
      discount_until: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      discount_on: true,
      length: 45,
      slot_minutes: 60,
      week: weekdays(['sat', 'mon', 'wed'], '14:00', '20:00', 1),
      closures: [],
      upcoming: 2,
    },
    {
      id: 5,
      title: 'ماک سفارت آمریکا حضوری',
      description: '',
      mode: 'in_person',
      active: false,
      price: 2_000_000,
      discounted_price: null,
      discount_until: null,
      discount_on: false,
      length: 90,
      slot_minutes: null,
      week: [],
      closures: [],
      upcoming: 0,
    },
  ],
  next: 20,
  nextClosure: 1,
});

let state = fresh();

export function resetConsultationTypeMocks() {
  state = fresh();
}

const FIELDS = [
  'title',
  'description',
  'active',
  'price',
  'discounted_price',
  'discount_until',
  'length',
  'slot_minutes',
  'week',
] as const;

/** Django's 400 for the body, or null. */
function problem(body: ConsultationTypeInput, row: ConsultationTypeRow | null) {
  if (body.title !== undefined && !body.title.trim()) return { title: ['Write a name.'] };
  const price = body.price ?? row?.price ?? 0;
  const discounted = body.discounted_price ?? null;
  if (discounted !== null && discounted >= price)
    return { discounted_price: ['The discounted price must be less than the price.'] };
  const week = body.week ?? [];
  if (week.some((item) => item.end <= item.start || item.capacity < 1))
    return { week: ['The end must be after the start.'] };
  const days = new Set(week.map((item) => item.day));
  if ([...days].some((day) => overlapping(week.filter((item) => item.day === day))))
    return { week: ['Two times of one day overlap.'] };
  return null;
}

function apply(row: ConsultationTypeRow, body: ConsultationTypeInput) {
  for (const field of FIELDS)
    if (body[field] !== undefined) Object.assign(row, { [field]: body[field] });
  if (body.discounted_price === null) row.discount_until = null;
  row.discount_on =
    row.discounted_price !== null &&
    !!row.discount_until &&
    new Date(row.discount_until).getTime() > Date.now();
}

export const consultationTypeHandlers = [
  http.get(`${BASE}/consultation-types/`, () =>
    manager() ? HttpResponse.json({ types: state.types }) : forbidden(),
  ),

  http.post(`${BASE}/consultation-types/`, async ({ request }) => {
    if (!manager()) return forbidden();
    const body = (await request.json()) as ConsultationTypeInput;
    const error = problem(body, null);
    if (error) return HttpResponse.json(error, { status: 400 });
    const row: ConsultationTypeRow = {
      id: state.next++,
      title: '',
      description: '',
      mode: body.mode ?? 'online',
      active: false,
      price: 0,
      discounted_price: null,
      discount_until: null,
      discount_on: false,
      length: 60,
      slot_minutes: null,
      week: [],
      closures: [],
      upcoming: 0,
    };
    apply(row, { ...body, title: (body.title ?? '').trim().split(/\s+/).join(' ') });
    state.types.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch(`${BASE}/consultation-types/:id/`, async ({ params, request }) => {
    if (!manager()) return forbidden();
    const row = state.types.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    const body = (await request.json()) as ConsultationTypeInput;
    if (body.mode && body.mode !== row.mode)
      return HttpResponse.json({ detail: 'mode', code: 'mode' }, { status: 409 });
    const error = problem(body, row);
    if (error) return HttpResponse.json(error, { status: 400 });
    apply(row, body);
    return HttpResponse.json(row);
  }),

  http.post(`${BASE}/consultation-types/:id/closures/`, async ({ params, request }) => {
    if (!manager()) return forbidden();
    const row = state.types.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    const body = (await request.json()) as { date: string; time: string | null };
    if (row.closures.some((item) => item.date === body.date && item.time === body.time))
      return HttpResponse.json({ detail: 'This time is closed already.' }, { status: 409 });
    row.closures = [
      ...row.closures,
      { id: state.nextClosure++, date: body.date, time: body.time, capacity: null },
    ].sort((a, b) => a.date.localeCompare(b.date));
    return HttpResponse.json(row, { status: 201 });
  }),

  http.delete(`${BASE}/consultation-closures/:id/`, ({ params }) => {
    if (!manager()) return forbidden();
    const id = Number(params.id);
    const row = state.types.find((item) => item.closures.some((closure) => closure.id === id));
    if (!row) return notFound();
    row.closures = row.closures.filter((closure) => closure.id !== id);
    return HttpResponse.json(row);
  }),
];
