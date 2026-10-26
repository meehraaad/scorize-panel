import { http, HttpResponse } from 'msw';
import {
  BACKGROUND_DEGREES,
  REVIEW_KINDS,
  type Background,
  type BackgroundWrite,
  type ReviewDocument,
  type ReviewKind,
} from '@/lib/applicant/journey';
import { forbidden, notFound, storage } from './session';

/**
 * Django's new-user dashboard steps (scorize-revolution `api/applicant/v1/journey.py`), for the
 * tests: files sent for a free review (H59) and the tablet form (H60). Any logged-in account.
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

export function resetJourneyMocks() {
  reviewOf.clear();
  backgroundOf.clear();
  nextId = 1;
}
