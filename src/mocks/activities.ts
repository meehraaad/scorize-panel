import { http, HttpResponse } from 'msw';
import type { Activity, ActivityResponse } from '@/lib/applicant/activities';
import { forbidden, notFound, storage } from './session';

/**
 * The applicant's to-dos (docs/backend-changes.md AC5) as Django would answer them: open ones not
 * put off, required first is the panel's job. Sara (user 1) has one of each kind the box answers.
 */

const BASE = '/api/applicant/v1/activities';

interface Row extends Activity {
  status: 'open' | 'done' | 'dismissed';
  snoozed: boolean;
}

const seed = (): Row[] =>
  [
    {
      id: 901,
      kind: 'upload',
      source: 'supervisor',
      from: 'علی احمدی',
      level: 'normal',
      required: true,
      title: 'اسکن صفحه‌ی اول پاسپورت',
      text: 'برای فرم سفارت لازم است.',
      due_at: '2026-10-30T20:30:00Z',
      progress: null,
      payload: { accept: ['pdf', 'jpg', 'png'] },
    },
    {
      id: 902,
      kind: 'survey',
      source: 'seller',
      from: 'سارا محمدی',
      level: 'normal',
      required: false,
      title: 'بعد از جلسه‌ی دیروز، تصمیمت چی شد؟',
      text: '',
      due_at: null,
      progress: null,
      payload: {
        choices: [
          { value: 'contract', label: 'قرارداد می‌بندم' },
          { value: 'think', label: 'هنوز فکر می‌کنم' },
          { value: 'cost', label: 'هزینه زیاد است' },
          { value: 'compare', label: 'دارم مقایسه می‌کنم' },
        ],
      },
    },
    {
      id: 903,
      kind: 'rating',
      source: 'consultant',
      from: 'مهسا رضایی',
      level: 'quiet',
      required: false,
      title: 'جلسه‌ی مشاوره چطور بود؟',
      text: '',
      due_at: null,
      progress: null,
      payload: { max: 5 },
    },
    {
      id: 904,
      kind: 'form',
      source: 'system',
      from: null,
      level: 'normal',
      required: true,
      title: 'فرم انگیزه‌نامه',
      text: 'نویسنده بعد از فرم شما شروع می‌کند.',
      due_at: null,
      progress: 40,
      payload: { href: '/documents/sop' },
    },
  ].map((item) => ({ ...(item as Activity), status: 'open', snoozed: false }));

const byUser = new Map<number, Row[]>();
const rowsOf = (user: number) => {
  if (!byUser.has(user)) byUser.set(user, user === 1 ? seed() : []);
  return byUser.get(user) ?? [];
};

/** Test helper: change one of a user's to-dos (e.g. make it urgent). */
export function patchMockActivity(user: number, id: number, patch: Partial<Activity>) {
  const row = rowsOf(user).find((item) => item.id === id);
  if (row) Object.assign(row, patch);
}

export function resetActivityMocks() {
  byUser.clear();
}

function own(params: Record<string, unknown>) {
  const user = storage.get();
  if (!user) return { error: forbidden() };
  const row = rowsOf(user).find((item) => item.id === Number(params.id) && item.status === 'open');
  return row ? { row } : { error: notFound() };
}

/** What `kinds.py` checks for each answer (AC2). */
function invalid(row: Row, response: ActivityResponse | undefined) {
  if (!response) return 'required';
  if (row.kind === 'survey')
    return 'choice' in response && row.payload.choices?.some((c) => c.value === response.choice)
      ? null
      : 'choice';
  if (row.kind === 'rating')
    return 'score' in response && response.score >= 1 && response.score <= (row.payload.max ?? 5)
      ? null
      : 'score';
  if (row.kind === 'question') return 'text' in response && response.text.trim() ? null : 'text';
  return 'kind';
}

export const activityHandlers = [
  http.get(`${BASE}/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    const results = rowsOf(user)
      .filter((item) => item.status === 'open' && !item.snoozed)
      .map(({ status: _status, snoozed: _snoozed, ...item }) => item);
    return HttpResponse.json({ results });
  }),

  http.post(`${BASE}/:id/respond/`, async ({ params, request }) => {
    const { row, error } = own(params);
    if (!row) return error;
    if (row.kind === 'upload') {
      const file = (await request.formData()).get('file');
      if (!(file instanceof File))
        return HttpResponse.json({ file: ['No file.'] }, { status: 400 });
    } else {
      const body = (await request.json()) as { response?: ActivityResponse };
      const field = invalid(row, body.response);
      if (field) return HttpResponse.json({ response: [field] }, { status: 400 });
    }
    row.status = 'done';
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${BASE}/:id/snooze/`, ({ params }) => {
    const { row, error } = own(params);
    if (!row) return error;
    row.snoozed = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/:id/dismiss/`, ({ params }) => {
    const { row, error } = own(params);
    if (!row) return error;
    if (row.required)
      return HttpResponse.json(
        { detail: 'A required activity can not be dismissed.', code: 'required' },
        { status: 409 },
      );
    row.status = 'dismissed';
    return new HttpResponse(null, { status: 204 });
  }),
];
