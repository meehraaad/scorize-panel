import { http, HttpResponse } from 'msw';
import {
  BACKGROUND_DEGREES,
  REVIEW_KINDS,
  type Background,
  type BackgroundWrite,
  type ReviewDocument,
  type ReviewKind,
  type StartOffers,
} from '@/lib/applicant/journey';
import { forbidden, notFound, storage } from './session';

/**
 * Django's new-user dashboard steps (scorize-revolution `api/applicant/v1/journey.py`,
 * `start.py`), for the tests: files sent for a free review (H59), the tablet form (H60), what to
 * start with (H63) and booking its consultation (H64). Any logged-in account.
 */

const BASE = '/api/applicant/v1';
const MAX_REVIEW_DOCUMENTS = 20;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const JOURNEY_FIELDS = [
  { id: 1, name: 'مهندسی' },
  { id: 2, name: 'پزشکی' },
];
export const JOURNEY_EXAMS = [
  { id: 1, name: 'IELTS', min: 0, max: 9 },
  { id: 2, name: 'TOEFL', min: 0, max: 120 },
];

/** Tomorrow and the two days after, 10:00 in Tehran (Django's schedule: never today). */
function nextSlots(): string[] {
  const day = 24 * 60 * 60_000;
  return [1, 2, 3].map((n) => {
    const date = new Date(Date.now() + n * day).toISOString().slice(0, 10);
    return new Date(`${date}T10:00:00+03:30`).toISOString();
  });
}

/**
 * The calendar's free times between two days (`YYYY-MM-DD`): from tomorrow, every 20 minutes from
 * 10:00 to 12:00 Tehran, not Thursday or Friday (Django: the type's `slot_minutes` schedule).
 */
function slotsBetween(from: string, to: string) {
  const slots: { at: string; left: number }[] = [];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
  for (let day = new Date(`${from > tomorrow ? from : tomorrow}T00:00:00Z`); ;) {
    const date = day.toISOString().slice(0, 10);
    if (date > to) break;
    if (day.getUTCDay() !== 4 && day.getUTCDay() !== 5)
      for (const time of ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40'])
        slots.push({ at: new Date(`${date}T${time}:00+03:30`).toISOString(), left: 2 });
    day = new Date(day.getTime() + 24 * 60 * 60_000);
  }
  return slots;
}

function defaultOffers(): StartOffers {
  return {
    consultation: {
      type: 3,
      title: 'مشاوره‌ی اپلای',
      minutes: 45,
      mode: 'online',
      price: 500_000,
      full_price: null,
      slots: nextSlots(),
    },
    contract: { price: 85_000_000, instalments: 4, instalment: 21_250_000, writing: true },
    consultant: null,
  };
}

const offersOf = new Map<number, Partial<StartOffers>>();
/** Bookings sent, for the tests. */
export const bookingsSent: { type: number; starts_at: string }[] = [];

const reviewOf = new Map<number, ReviewDocument[]>();
const backgroundOf = new Map<number, BackgroundWrite>();
let nextId = 1;

const EMPTY: BackgroundWrite = {
  personal: { city: '', birth_date: null, work_years: 0, articles: 0 },
  educations: [],
  exams: [],
};

function backgroundFor(user: number): Background {
  const saved = backgroundOf.get(user) ?? EMPTY;
  const first = saved.educations[0];
  return {
    personal: saved.personal,
    educations: saved.educations.map((item, index) => ({
      ...item,
      id: index + 1,
      field_name: JOURNEY_FIELDS.find((field) => field.id === item.field)?.name ?? null,
    })),
    exams: saved.exams.map((item) => ({ ...item, verified: false })),
    // Django: a city and one degree with its university and GPA.
    complete: Boolean(saved.personal.city.trim() && first?.university.trim() && first.gpa > 0),
    fields: JOURNEY_FIELDS,
    exam_options: JOURNEY_EXAMS,
  };
}

export const journeyHandlers = [
  http.get(`${BASE}/start/`, () => {
    const user = storage.get();
    return user ? HttpResponse.json({ ...defaultOffers(), ...offersOf.get(user) }) : forbidden();
  }),

  http.get(`${BASE}/consultations/slots/`, ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const query = new URL(request.url).searchParams;
    const offer = { ...defaultOffers(), ...offersOf.get(user) }.consultation;
    return HttpResponse.json({
      type: offer?.type ?? null,
      slots: offer ? slotsBetween(query.get('from') ?? '', query.get('to') ?? '') : [],
    });
  }),

  http.post(`${BASE}/consultations/book/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const sent = (await request.json()) as { type: number; starts_at: string };
    const offer = { ...defaultOffers(), ...offersOf.get(user) }.consultation;
    if (!offer || offer.type !== sent.type)
      return HttpResponse.json(
        { type: ['This consultation can not be booked here.'] },
        { status: 400 },
      );
    const day = new Date(sent.starts_at).toISOString().slice(0, 10);
    const free = [...offer.slots, ...slotsBetween(day, day).map((slot) => slot.at)];
    if (!free.includes(sent.starts_at))
      return HttpResponse.json({ starts_at: ['This time is taken.'] }, { status: 400 });
    bookingsSent.push(sent);
    // Django: the gateway (a relative path when the visitor's IP needs checking first).
    return HttpResponse.json(
      { consultation: 900, payment_id: 77, redirect_url: '/finance/payment-ip-check/AUTH77/' },
      { status: 201 },
    );
  }),

  http.get(`${BASE}/review-documents/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    return HttpResponse.json({ results: reviewOf.get(user) ?? [] });
  }),

  http.post(`${BASE}/review-documents/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const body = await request.formData();
    const kind = body.get('kind');
    const file = body.get('file');
    if (typeof kind !== 'string' || !REVIEW_KINDS.includes(kind as ReviewKind))
      return HttpResponse.json({ kind: ['invalid'] }, { status: 400 });
    if (!(file instanceof File) || file.size > MAX_BYTES || !TYPES.includes(file.type))
      return HttpResponse.json({ file: ['invalid'] }, { status: 400 });
    const list = reviewOf.get(user) ?? [];
    if (list.length >= MAX_REVIEW_DOCUMENTS)
      return HttpResponse.json({ detail: 'Too many.', code: 'too_many' }, { status: 409 });
    const item: ReviewDocument = {
      id: nextId++,
      kind: kind as ReviewKind,
      url: `https://scorize.local/media/review/${file.name}`,
      ext: (file.name.split('.').pop() ?? '').toUpperCase(),
      uploaded_at: new Date().toISOString(),
    };
    // Newest first, as Django lists them.
    reviewOf.set(user, [item, ...list]);
    return HttpResponse.json(item, { status: 201 });
  }),

  http.delete(`${BASE}/review-documents/:id/`, ({ params }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const list = reviewOf.get(user) ?? [];
    if (!list.some((item) => item.id === Number(params.id))) return notFound();
    reviewOf.set(
      user,
      list.filter((item) => item.id !== Number(params.id)),
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/background/`, () => {
    const user = storage.get();
    return user ? HttpResponse.json(backgroundFor(user)) : forbidden();
  }),

  http.put(`${BASE}/background/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const sent = (await request.json()) as BackgroundWrite;
    if (sent.educations.some((item) => !BACKGROUND_DEGREES.includes(item.degree)))
      return HttpResponse.json({ educations: ['invalid'] }, { status: 400 });
    const exam = sent.exams.find((item) => {
      const option = JOURNEY_EXAMS.find((choice) => choice.id === item.exam);
      return !option || item.score < option.min || item.score > option.max;
    });
    if (exam) return HttpResponse.json({ exams: ['invalid'] }, { status: 400 });
    backgroundOf.set(user, sent);
    return HttpResponse.json(backgroundFor(user));
  }),
];

/** What the tests read back. */
export const reviewDocumentsOf = (user: number) => reviewOf.get(user) ?? [];
export const savedBackgroundOf = (user: number) => backgroundOf.get(user);

/** What `start/` answers this user, over the defaults. */
export function setStartOffers(user: number, offers: Partial<StartOffers>) {
  offersOf.set(user, offers);
}

export function resetJourneyMocks() {
  offersOf.clear();
  bookingsSent.length = 0;
  reviewOf.clear();
  backgroundOf.clear();
  nextId = 1;
}
