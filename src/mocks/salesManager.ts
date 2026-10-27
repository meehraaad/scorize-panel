import { http, HttpResponse } from 'msw';
import type {
  AssignData,
  AssignSettings,
  ContractDraft,
  FunnelData,
  HealthData,
  HealthTeam,
  TeamData,
  TeamRange,
} from '@/features/sales/api';
import { forbidden, notFound, pageOf, storage } from './session';
import { failed, stateOrError, type SalesState } from './sales';
import { openHandoff } from './handoff';

/**
 * Fake sales-manager API (docs/backend-changes.md S34–S40, T12). Only Reza (user 4, with
 * can_assign_to_seller) may use it, like Django's CanAssignToStaff.
 */

const MANAGERS = new Set([4]);
const BASE = '/api/sales/v1/manager';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

interface ManagerState {
  settings: AssignSettings;
  queue: AssignData['queue']['results'];
  /** Leads given out, by seller. */
  assigned: Map<number, number>;
  decided: Set<number>;
  reminded: Set<number>;
  oldest: HealthData['oldest'];
}

const NIMA = 8;
const MAHDI = 31;
const SARA = 32;
const OMID = 33;
const KAVEH = 34;

const managerState = (): ManagerState => ({
  settings: { on: true, mode: 'least_load', escalation: 'alert' },
  queue: [
    {
      lead: 901,
      customer: 130,
      name: 'آیدا شفیعی',
      degree: 2,
      countries: ['ایتالیا'],
      cause: 'خرید ناموفق «مشاوره‌ی اپلای ایتالیا»',
      score: 72,
      created_at: ago(26 * MINUTE),
      suggested: OMID,
    },
    {
      lead: 902,
      customer: 131,
      name: 'سینا قربانی',
      degree: 3,
      countries: ['کانادا'],
      cause: 'درخواست تماس از پنل · صفحه‌ی قرارداد',
      score: 79,
      created_at: ago(18 * MINUTE),
      suggested: MAHDI,
    },
    {
      lead: 903,
      customer: 132,
      name: 'نگین افشار',
      degree: 1,
      countries: ['ترکیه'],
      cause: 'مسیر اپلای رایگان ترکیه · مدارک آپلود شد',
      score: 58,
      created_at: ago(9 * MINUTE),
      suggested: OMID,
    },
    {
      lead: 904,
      customer: 133,
      name: 'رامین کیانی',
      degree: 2,
      countries: ['آلمان'],
      cause: 'تخمین شانس پذیرش',
      score: 44,
      created_at: ago(4 * MINUTE),
      suggested: MAHDI,
    },
  ],
  assigned: new Map(),
  decided: new Set(),
  reminded: new Set(),
  oldest: [
    {
      task: 801,
      text: 'پیشنهاد اقساطی را برای داوود صالحی بفرست',
      person: 'داوود صالحی',
      context: 'لید',
      owner: { id: KAVEH, name: 'کاوه نادری' },
      days: 6,
    },
    {
      task: 802,
      text: 'تماس دوم با لید وبینار کانادا',
      person: 'آرش نیکو',
      context: 'لید',
      owner: { id: KAVEH, name: 'کاوه نادری' },
      days: 5,
    },
    {
      task: 803,
      text: 'متقاضی ۲ اپلای را تأیید نکرده؛ ددلاین نزدیک',
      person: 'سارا محمدی',
      context: 'پرونده ۱۲۴۰',
      owner: { id: 21, name: 'حسین رحیمی' },
      days: 3,
    },
  ],
});

let manager: ManagerState | null = null;

function managerOrError(): { sales: SalesState; manager: ManagerState } | Response {
  const user = storage.get();
  if (!user || !MANAGERS.has(user)) return forbidden();
  const sales = stateOrError();
  if (failed(sales)) return sales;
  manager ??= managerState();
  return { sales, manager };
}

const sellers = (state: ManagerState): AssignData['sellers'] => {
  const extra = (id: number) =>
    [...state.assigned.values()].filter((seller) => seller === id).length;
  return [
    {
      id: NIMA,
      name: 'نیما رستمی',
      status: 'available',
      busy_until: null,
      open: 18 + extra(NIMA),
      uncalled: 6,
      response_minutes: 22,
    },
    {
      id: MAHDI,
      name: 'مهدی توکلی',
      status: 'available',
      busy_until: null,
      open: 11 + extra(MAHDI),
      uncalled: 1,
      response_minutes: 14,
    },
    {
      id: SARA,
      name: 'سارا جهانی',
      status: 'busy',
      busy_until: new Date(Date.now() + 2 * HOUR).toISOString(),
      open: 15 + extra(SARA),
      uncalled: 3,
      response_minutes: 31,
    },
    {
      id: OMID,
      name: 'امید رنجبر',
      status: 'available',
      busy_until: null,
      open: 7 + extra(OMID),
      uncalled: 0,
      response_minutes: 12,
    },
    {
      id: KAVEH,
      name: 'کاوه نادری',
      status: 'away',
      busy_until: null,
      open: 9,
      uncalled: 2,
      response_minutes: 40,
    },
  ];
};

function draftsOf(sales: SalesState, state: ManagerState): ContractDraft[] {
  const fromLeads = sales.customers
    .filter((item) => item.lead.stage === 'draft' && !state.decided.has(item.lead.id))
    .map((item): ContractDraft => {
      const offer = sales.offers.get(item.id);
      const discount = offer?.discount ?? 15;
      return {
        id: item.lead.id,
        customer: item.id,
        name: item.name,
        created_at: item.lead.stage_since,
        summary: `${item.lead.summary} · ${String(Math.round((item.lead.amount ?? 0) / 1_000_000))} میلیون تومان`,
        seller: 'نیما رستمی',
        discount,
        meta: `${item.countries.join('، ')} · فروشنده: نیما رستمی`,
        terms: [
          { key: 'services', value: offer ? offer.features.join('، ') : 'پذیرش و ویزا' },
          { key: 'degree', value: `ارشد · ${item.countries.join('، ')}` },
          { key: 'applies', value: String(offer?.applies ?? 8) },
          { key: 'period', value: `${String(offer?.months ?? 12)} ماه` },
          {
            key: 'amount',
            value: `${String(Math.round((item.lead.amount ?? 0) / 1_000_000))} میلیون تومان`,
          },
          { key: 'instalments', value: `${String(offer?.instalments ?? 3)} قسط` },
          { key: 'language', value: offer?.language_score || 'IELTS 6' },
        ],
        checks: [
          discount > 10
            ? { ok: false, text: `تخفیف ${String(discount)}٪ از سقف ۱۰٪ فروشنده بیشتر است` }
            : { ok: true, text: 'تخفیف در سقف فروشنده است' },
          { ok: true, text: 'مبلغ با جدول قیمت خدمات هم‌خوانی دارد' },
          { ok: true, text: 'مشتری پرداخت ناموفق یا بدهی باز ندارد' },
        ],
        note:
          offer?.manager_note || 'ددلاین‌ها از بهمن شروع می‌شود؛ تخفیف برای بستن همین هفته است.',
      };
    });
  return fromLeads;
}

const teamOf = (range: TeamRange): TeamData => {
  const scale = range === 'quarter' ? 3 : 1;
  const now = new Date();
  const from = new Date(
    now.getFullYear(),
    now.getMonth() - (range === 'last' ? 1 : range === 'quarter' ? 2 : 0),
    1,
  );
  return {
    from: from.toISOString(),
    won: 26 * scale,
    target: 45 * scale,
    days_left: range === 'month' ? 8 : 0,
    sales: 2_400_000_000 * scale,
    sales_change: 0.18,
    conversion: 0.12,
    conversion_before: 0.09,
    first_call_minutes: 24,
    sellers: [
      {
        id: MAHDI,
        name: 'مهدی توکلی',
        won: 9,
        target: 10,
        sales: 820_000_000,
        conversion: 0.16,
        first_call_minutes: 14,
        overdue: 0,
      },
      {
        id: NIMA,
        name: 'نیما رستمی',
        won: 7,
        target: 12,
        sales: 640_000_000,
        conversion: 0.15,
        first_call_minutes: 22,
        overdue: 3,
      },
      {
        id: OMID,
        name: 'امید رنجبر',
        won: 5,
        target: 8,
        sales: 410_000_000,
        conversion: 0.13,
        first_call_minutes: 12,
        overdue: 1,
      },
      {
        id: SARA,
        name: 'سارا جهانی',
        won: 3,
        target: 8,
        sales: 310_000_000,
        conversion: 0.08,
        first_call_minutes: 31,
        overdue: 4,
      },
      {
        id: KAVEH,
        name: 'کاوه نادری',
        won: 2,
        target: 7,
        sales: 220_000_000,
        conversion: 0.06,
        first_call_minutes: 40,
        overdue: 6,
      },
    ],
    alerts: [
      { kind: 'unattended', seller: 'کاوه نادری', count: 2 },
      { kind: 'draft', customer: 'نازنین کریمی', discount: 15 },
      { kind: 'no_offer', count: 6 },
    ],
    sources: [
      { source: 'consultation', leads: 41, won: 11, sales: 1_100_000_000 },
      { source: 'call_request', leads: 28, won: 6, sales: 520_000_000 },
      { source: 'referral', leads: 9, won: 3, sales: 290_000_000 },
      { source: 'campaign', leads: 96, won: 4, sales: 310_000_000 },
      { source: 'failed_purchase', leads: 64, won: 2, sales: 160_000_000 },
      { source: 'chance_estimate', leads: 38, won: 0, sales: 0 },
    ],
  };
};

const healthOf = (state: ManagerState, team: HealthTeam): HealthData => {
  const people: HealthData['people'] = [
    {
      id: KAVEH,
      name: 'کاوه نادری',
      role: 'sales',
      on_time: 0.52,
      overdue: 9,
      orphans: 3,
      snoozed: 4,
      oldest_days: 6,
    },
    {
      id: SARA,
      name: 'سارا جهانی',
      role: 'sales',
      on_time: 0.64,
      overdue: 5,
      orphans: 2,
      snoozed: 2,
      oldest_days: 3,
    },
    {
      id: 21,
      name: 'حسین رحیمی',
      role: 'supervisor',
      on_time: 0.71,
      overdue: 4,
      orphans: 2,
      snoozed: 1,
      oldest_days: 3,
    },
    {
      id: NIMA,
      name: 'نیما رستمی',
      role: 'sales',
      on_time: 0.86,
      overdue: 3,
      orphans: 2,
      snoozed: 2,
      oldest_days: 2,
    },
    {
      id: 7,
      name: 'مریم کاظمی',
      role: 'supervisor',
      on_time: 0.89,
      overdue: 2,
      orphans: 1,
      snoozed: 1,
      oldest_days: 1,
    },
    {
      id: OMID,
      name: 'امید رنجبر',
      role: 'sales',
      on_time: 0.95,
      overdue: 0,
      orphans: 1,
      snoozed: 0,
      oldest_days: null,
    },
  ];
  return {
    on_time: { value: 0.78, target: 0.9, weeks: [0.6, 0.66, 0.71, 0.78] },
    overdue: { value: 23, over_two_days: 9, weeks: [34, 30, 27, 23] },
    orphans: { value: 11, customers: 7, files: 4, weeks: [28, 22, 17, 11] },
    automatic: { value: 0.41, weeks: [0.2, 0.28, 0.35, 0.41] },
    people: people.filter(
      (person) =>
        team === 'all' ||
        (team === 'sales' ? person.role === 'sales' : person.role === 'supervisor'),
    ),
    oldest: state.oldest,
    colleagues: people.map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role === 'sales' ? 'فروش' : 'سوپروایزر',
    })),
  };
};

/** Django's `QUEUE_PAGE` (api/sales/v1/manager.py). */
const QUEUE_PAGE = 20;

export const managerHandlers = [
  http.get(`${BASE}/assign/`, ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const queue = data.manager.queue.filter((lead) => !data.manager.assigned.has(lead.lead));
    const body: AssignData = {
      settings: data.manager.settings,
      sellers: sellers(data.manager),
      queue: pageOf(request, queue, QUEUE_PAGE),
      oldest_at: queue.map((lead) => lead.created_at).sort()[0] ?? null,
    };
    return HttpResponse.json(body);
  }),

  http.put(`${BASE}/assign/settings/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    data.manager.settings = (await request.json()) as AssignSettings;
    return HttpResponse.json(data.manager.settings);
  }),

  http.post(`${BASE}/assign/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const { assignments } = (await request.json()) as {
      assignments: { lead: number; seller: number }[];
    };
    let assigned = 0;
    for (const item of assignments) {
      if (
        data.manager.queue.some((lead) => lead.lead === item.lead) &&
        !data.manager.assigned.has(item.lead)
      ) {
        data.manager.assigned.set(item.lead, item.seller);
        assigned++;
      }
    }
    return HttpResponse.json({ assigned });
  }),

  http.get(`${BASE}/approvals/`, () => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    return HttpResponse.json({ drafts: draftsOf(data.sales, data.manager) });
  }),

  http.post(`${BASE}/approvals/:id/`, async ({ params, request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const item = data.sales.customers.find((entry) => entry.lead.id === Number(params.id));
    if (item?.lead.stage !== 'draft') return notFound();
    const { action, comment } = (await request.json()) as { action: string; comment: string };
    if (action !== 'approve' && !comment.trim())
      return HttpResponse.json({ comment: ['required'] }, { status: 400 });
    data.manager.decided.add(item.lead.id);
    item.lead.manager = false;
    item.lead.stage_since = new Date().toISOString();
    if (action === 'approve') {
      item.lead.stage = 'won';
      openHandoff(item.id, item.name, item.lead.amount ?? 0, item.countries);
    } else if (action === 'return') item.lead.stage = 'offer';
    else {
      item.lead.stage = 'lost';
      item.lead.lost_reason = 'later';
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/team/`, ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const range = (new URL(request.url).searchParams.get('range') ?? 'month') as TeamRange;
    return HttpResponse.json(teamOf(range));
  }),

  http.get(`${BASE}/estimate-funnel/`, () => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const funnel: FunnelData = {
      start: '2026-10-23',
      end: '2026-11-22',
      steps: { started: 200, finished: 120, wanted_call: 90, called: 81, contract: 9 },
      first_call_minutes: 14,
      by_goal: [
        { goal: 'study', started: 100, finished: 95, wanted_call: 70, called: 64, contract: 8 },
        { goal: 'work', started: 15, finished: 15, wanted_call: 12, called: 10, contract: 0 },
        { goal: 'both', started: 10, finished: 10, wanted_call: 8, called: 7, contract: 1 },
        { goal: 'unknown', started: 75, finished: 0, wanted_call: 0, called: 0, contract: 0 },
      ],
    };
    return HttpResponse.json(funnel);
  }),

  http.get(`${BASE}/follow-ups/`, ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const team = (new URL(request.url).searchParams.get('team') ?? 'all') as HealthTeam;
    return HttpResponse.json(healthOf(data.manager, team));
  }),

  http.post('/api/staff/v1/tasks/:id/remind/', ({ params }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    data.manager.reminded.add(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/staff/v1/tasks/:id/reassign/', async ({ params, request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const task = data.manager.oldest.find((item) => item.task === Number(params.id));
    if (!task) return notFound();
    const { assignee } = (await request.json()) as { assignee: number };
    const person = healthOf(data.manager, 'all').colleagues.find((item) => item.id === assignee);
    if (!person) return HttpResponse.json({ assignee: ['invalid'] }, { status: 400 });
    task.owner = { id: person.id, name: person.name };
    task.days = 0;
    return new HttpResponse(null, { status: 204 });
  }),
];

export function resetManagerMocks() {
  manager = null;
}
