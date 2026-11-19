import { http, HttpResponse } from 'msw';
import {
  SYSTEM_SOURCES,
  UPLOAD_SYSTEM_SOURCES,
  type LeadImportOptions,
  type LeadSourceRow,
} from '@/lib/leads/api';
import { previewLeadImport, takeLeadImport } from './salesManager';
import { forbidden, notFound, storage } from './session';

/**
 * Lead sources as Django answers them (api/marketing/v1/sources.py, api/sales/v1/sources.py) and
 * the marketing panel's CSV upload (api/marketing/v1/leads.py: the sales manager's upload, leads
 * always to the queue). The system sources come first and can't change; a used source is
 * archived when deleted.
 */
const MARKETING = '/api/marketing/v1';
const SALES = '/api/sales/v1';
const MARKETERS = new Set([6, 7]);
const SELLERS = new Set([3, 4]);
const SYSTEM_NAMES: Record<string, string> = {
  failed_purchase: 'خرید ناموفق',
  call_request: 'درخواست تماس',
  chance_estimate: 'تخمین شانس پذیرش',
  document_upload: 'مدرک برای ارزیابی',
  campaign: 'کمپین و فرم سایت',
  consultation: 'مشاوره',
  manual: 'ثبت دستی',
};

interface Stored {
  id: number;
  name: string;
  active: boolean;
  leads: number;
}

const fresh = () => ({
  sources: [
    { id: 1, name: 'اینستاگرام', active: true, leads: 3 },
    { id: 2, name: 'نمایشگاه پاییز', active: false, leads: 5 },
  ] as Stored[],
  next: 3,
});
let state = fresh();

export function resetLeadSourceMocks() {
  state = fresh();
}

/** Same as Django's `tag_key`, enough for the tests: spaces, ي/ك, half-space. */
const keyOf = (name: string) =>
  name
    .replace(/‌/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .split(/\s+/)
    .join(' ')
    .trim()
    .toLowerCase();

const custom = (source: Stored, counts: boolean): LeadSourceRow => ({
  id: source.id,
  code: `c${String(source.id)}`,
  name: source.name,
  system: false,
  active: source.active,
  ...(counts && { leads: source.leads }),
});

const rows = (counts: boolean): LeadSourceRow[] => [
  ...SYSTEM_SOURCES.map((code) => ({
    id: null,
    code,
    name: SYSTEM_NAMES[code] ?? code,
    system: true,
    active: true,
    ...(counts && { leads: 0 }),
  })),
  ...state.sources.map((source) => custom(source, counts)),
];

/** Whether an upload may name `code`: `campaign`, `manual` or an active team source. */
export const uploadSource = (code: string) =>
  (UPLOAD_SYSTEM_SOURCES as readonly string[]).includes(code) ||
  state.sources.some((source) => source.active && `c${String(source.id)}` === code);

const marketer = () => MARKETERS.has(storage.get() ?? 0);
const taken = (name: string, except?: number) =>
  Object.values(SYSTEM_NAMES).some((system) => keyOf(system) === keyOf(name)) ||
  state.sources.some((source) => source.id !== except && keyOf(source.name) === keyOf(name));
const nameError = () => HttpResponse.json({ name: ['منبعی با همین نام هست.'] }, { status: 400 });

export const leadSourceHandlers = [
  http.get(`${SALES}/sources/`, () =>
    SELLERS.has(storage.get() ?? 0) ? HttpResponse.json(rows(false)) : forbidden(),
  ),
  http.get(`${MARKETING}/sources/`, () =>
    marketer() ? HttpResponse.json(rows(true)) : forbidden(),
  ),
  http.post(`${MARKETING}/sources/`, async ({ request }) => {
    if (!marketer()) return forbidden();
    const { name = '' } = (await request.json()) as { name?: string };
    if (!name.trim() || taken(name)) return nameError();
    const source = { id: state.next++, name: name.trim(), active: true, leads: 0 };
    state.sources.push(source);
    return HttpResponse.json(custom(source, true), { status: 201 });
  }),
  http.patch(`${MARKETING}/sources/:id/`, async ({ params, request }) => {
    if (!marketer()) return forbidden();
    const source = state.sources.find((item) => item.id === Number(params.id));
    if (!source) return notFound();
    const body = (await request.json()) as { name?: string; active?: boolean };
    if (body.name !== undefined) {
      if (!body.name.trim() || taken(body.name, source.id)) return nameError();
      source.name = body.name.trim();
    }
    if (body.active !== undefined) source.active = body.active;
    return HttpResponse.json(custom(source, true));
  }),
  http.delete(`${MARKETING}/sources/:id/`, ({ params }) => {
    if (!marketer()) return forbidden();
    const source = state.sources.find((item) => item.id === Number(params.id));
    if (!source) return notFound();
    if (source.leads > 0) {
      source.active = false;
      return HttpResponse.json(custom(source, true));
    }
    state.sources = state.sources.filter((item) => item !== source);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${MARKETING}/leads/import/preview/`, async ({ request }) => {
    if (!marketer()) return forbidden();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return HttpResponse.json({ file: ['required'] }, { status: 400 });
    return HttpResponse.json(previewLeadImport(file.name, file.size, await file.text()));
  }),
  http.post(`${MARKETING}/leads/import/`, async ({ request }) => {
    if (!marketer()) return forbidden();
    const { token, source } = (await request.json()) as LeadImportOptions;
    if (!uploadSource(source)) return HttpResponse.json({ source: ['invalid'] }, { status: 400 });
    const work = takeLeadImport(token);
    if (!work) return HttpResponse.json({ token: ['expired'] }, { status: 400 });
    const team = state.sources.find((item) => `c${String(item.id)}` === source);
    if (team) team.leads += work.length;
    return HttpResponse.json({ created: work.length, new_customers: work.length });
  }),
];
