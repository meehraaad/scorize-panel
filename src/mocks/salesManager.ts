import { http, HttpResponse } from 'msw';
import type {
  AssignData,
  CommissionRule,
  CommissionRuleInput,
  AssignSettings,
  ContractDraft,
  FunnelData,
  HealthData,
  HealthTeam,
  LeadImportChange,
  LeadImportOptions,
  LeadImportPreview,
  LeadImportProblem,
  StageInput,
  TeamData,
  TeamRange,
} from '@/features/sales/api';
import { forbidden, notFound, pageOf, storage } from './session';
import { failed, saveStages, stagesOf, stateOrError, type SalesState } from './sales';
import { openHandoff } from './handoff';

/**
 * Fake sales-manager API (docs/backend-changes.md S34–S40, T12; the board's stages S48). Only Reza (user 4, with
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
  /** Sellers hidden from the load cards. */
  hidden: Set<number>;
  oldest: HealthData['oldest'];
}

const NIMA = 8;
const MAHDI = 31;
const SARA = 32;
const OMID = 33;
const KAVEH = 34;
const SELLER_NAMES = new Map([
  [MAHDI, 'مهدی توکلی'],
  [NIMA, 'نیما رستمی'],
  [SARA, 'سارا جهانی'],
  [OMID, 'امید رنجبر'],
  [KAVEH, 'کاوه نادری'],
]);

const managerState = (): ManagerState => ({
  settings: {
    on: true,
    mode: 'least_load',
    escalation: 'alert',
    day_start: null,
    day_end: null,
    escalate_after: 2880,
  },
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
  hidden: new Set(),
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

/** The commission rules (S60) in force this month, as api/sales/v1/commission.py lists them. */
const freshRules = (): CommissionRule[] => [
  {
    id: 1,
    seller: null,
    seller_name: null,
    basis: 'contracts',
    threshold: 4,
    reward: 'percent',
    percent: 2,
    amount: null,
    since: '2026-10-23',
  },
  {
    id: 2,
    seller: null,
    seller_name: null,
    basis: 'contracts',
    threshold: 8,
    reward: 'percent',
    percent: 3,
    amount: null,
    since: '2026-10-23',
  },
  {
    id: 3,
    seller: null,
    seller_name: null,
    basis: 'sales',
    threshold: 700_000_000,
    reward: 'percent',
    percent: 4,
    amount: null,
    since: '2026-10-23',
  },
  {
    id: 4,
    seller: null,
    seller_name: null,
    basis: 'contracts',
    threshold: 10,
    reward: 'bonus',
    percent: null,
    amount: 5_000_000,
    since: '2026-10-23',
  },
];
let commissionRules = freshRules();
let nextRule = 10;

/** A seller's commission, as Django's `commission_of` (no fixed rate from a target here). */
function commissionOf(seller: number, won: number, sales: number): number | null {
  const mine = commissionRules.filter((rule) => rule.seller === null || rule.seller === seller);
  if (mine.length === 0) return null;
  const reached = mine.filter(
    (rule) => (rule.basis === 'contracts' ? won : sales) >= rule.threshold,
  );
  const best = (reward: CommissionRule['reward'], field: 'percent' | 'amount') =>
    Math.max(
      0,
      ...reached.filter((rule) => rule.reward === reward).map((rule) => rule[field] ?? 0),
    );
  const tiersOf = (basis: CommissionRule['basis']) =>
    mine
      .filter((rule) => rule.reward === 'tiered' && rule.basis === basis)
      .sort((a, b) => a.threshold - b.threshold);
  const bySales = tiersOf('sales').reduce((sum, tier, index, tiers) => {
    const top = tiers[index + 1]?.threshold ?? sales;
    return sum + (Math.max(0, Math.min(sales, top) - tier.threshold) * (tier.percent ?? 0)) / 100;
  }, 0);
  // Contract by contract, on an average contract (Django's `tiered_by_contracts`).
  const points = tiersOf('contracts').reduce((sum, tier, index, tiers) => {
    const last = (tiers[index + 1]?.threshold ?? won + 1) - 1;
    return (
      sum + Math.max(0, Math.min(won, last) - Math.max(tier.threshold, 1) + 1) * (tier.percent ?? 0)
    );
  }, 0);
  const byContracts = won ? ((sales / won) * points) / 100 : 0;
  const share = Math.max((sales * best('percent', 'percent')) / 100, bySales, byContracts);
  return Math.round(share + best('bonus', 'amount') + best('per_contract', 'amount') * won);
}

/** Django's RuleSerializer checks, with its error shapes. */
function ruleError(body: CommissionRuleInput, id?: number): Record<string, string[]> | null {
  const inPercent = body.reward === 'percent' || body.reward === 'tiered';
  if (inPercent && !(body.percent && body.percent > 0 && body.percent <= 100))
    return { percent: ['Give a percent above zero.'] };
  if (!inPercent && !(body.amount && body.amount > 0))
    return { amount: ['Give an amount above zero.'] };
  if (body.threshold < 0 || (body.basis === 'contracts' && body.threshold > 1000))
    return { threshold: ['At most 1000 contracts.'] };
  if (body.seller !== null && !SELLER_NAMES.has(body.seller))
    return { seller: ['Choose an active seller.'] };
  if (
    commissionRules.some(
      (rule) =>
        rule.id !== id &&
        rule.seller === body.seller &&
        rule.basis === body.basis &&
        rule.reward === body.reward &&
        rule.threshold === body.threshold,
    )
  )
    return { threshold: ['There is already a rule for this step.'] };
  return null;
}

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
      office_extension: 250,
      mobile_extension: 301,
      hidden: state.hidden.has(NIMA),
    },
    {
      id: MAHDI,
      name: 'مهدی توکلی',
      status: 'available',
      busy_until: null,
      open: 11 + extra(MAHDI),
      uncalled: 1,
      response_minutes: 14,
      office_extension: 251,
      mobile_extension: null,
      hidden: state.hidden.has(MAHDI),
    },
    {
      id: SARA,
      name: 'سارا جهانی',
      status: 'busy',
      busy_until: new Date(Date.now() + 2 * HOUR).toISOString(),
      open: 15 + extra(SARA),
      uncalled: 3,
      response_minutes: 31,
      office_extension: 252,
      mobile_extension: 302,
      hidden: state.hidden.has(SARA),
    },
    {
      id: OMID,
      name: 'امید رنجبر',
      status: 'available',
      busy_until: null,
      open: 7 + extra(OMID),
      uncalled: 0,
      response_minutes: 12,
      office_extension: null,
      mobile_extension: null,
      hidden: state.hidden.has(OMID),
    },
    {
      id: KAVEH,
      name: 'کاوه نادری',
      status: 'away',
      busy_until: null,
      open: 9,
      uncalled: 2,
      response_minutes: 40,
      office_extension: 253,
      mobile_extension: null,
      hidden: state.hidden.has(KAVEH),
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
        commission: null,
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
        commission: null,
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
        commission: null,
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
        commission: null,
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
        commission: null,
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

/** Django's `imports.COLUMNS` (api/sales/v1/imports.py), a few of each. */
const IMPORT_COLUMNS: Record<string, readonly string[]> = {
  phone: ['phone_number', 'phone', 'mobile', 'شماره', 'موبایل'],
  first: ['first_name', 'name', 'نام'],
  last: ['last_name', 'نام_خانوادگی'],
};
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** `09xxxxxxxxx` from what people type, like Django's `phone_of`. */
function phoneOf(value: string) {
  let digits = value.replace(/[۰-۹]/g, (c) => String(PERSIAN_DIGITS.indexOf(c))).replace(/\D/g, '');
  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
}
interface ImportWork {
  phone: string;
  name: string;
}
const leadImports = new Map<string, ImportWork[]>();
/** Contracts the manager moved to another seller in this run (S59). */
const movedLeads = new Set<number>();
/** Numbers the fake Django already knows, and whether each has an open lead. */
const knownPhones = (): Map<string, boolean> =>
  new Map([
    ['09120000001', false],
    ['09120000002', true],
  ]);
let KNOWN_PHONES = knownPhones();

function previewLeadImport(name: string, size: number, text: string): LeadImportPreview {
  const [head = '', ...lines] = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = head.split(',').map((cell) => cell.trim().toLowerCase().replace(/\s+/g, '_'));
  const at = (key: string) => header.findIndex((cell) => IMPORT_COLUMNS[key]?.includes(cell));
  const [phoneAt, firstAt, lastAt] = [at('phone'), at('first'), at('last')];
  const seen = new Set<string>();
  const rows: LeadImportPreview['rows'] = [];
  const work: ImportWork[] = [];
  lines.forEach((line, index) => {
    const cells = line.split(',').map((cell) => cell.trim());
    if (!cells.some(Boolean)) return;
    const typed = cells[phoneAt] ?? '';
    const phone = phoneOf(typed);
    const person = [cells[firstAt], cells[lastAt]].filter(Boolean).join(' ');
    const known = phone !== null && KNOWN_PHONES.has(phone);
    const problem: LeadImportProblem | null =
      phoneAt < 0
        ? 'missing_column'
        : phone === null
          ? 'bad_phone'
          : seen.has(phone)
            ? 'duplicate'
            : KNOWN_PHONES.get(phone)
              ? 'open_lead'
              : null;
    if (phone) seen.add(phone);
    const change: LeadImportChange = problem ? 'skip' : known ? 'existing' : 'new';
    rows.push({
      line: index + 2,
      phone: phone ?? typed,
      name: person,
      customer: known ? 500 + index : null,
      change,
      problem,
    });
    if (!problem && phone) work.push({ phone, name: person });
  });
  const count = (change: LeadImportChange) => rows.filter((row) => row.change === change).length;
  const token = `lead-import-${String(leadImports.size + 1)}`;
  leadImports.set(token, work);
  return {
    token,
    file: { name, size, rows: rows.length },
    counts: { new: count('new'), existing: count('existing'), skip: count('skip') },
    rows,
  };
}

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

  http.put(`${BASE}/assign/hidden/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const { sellers: ids } = (await request.json()) as { sellers: number[] };
    data.manager.hidden = new Set(ids);
    return new HttpResponse(null, { status: 204 });
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

  http.get(`${BASE}/leads/import/sample/`, () => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    return new HttpResponse(
      'phone_number,first_name,last_name,email,note\n09121234567,سارا,احمدی,sara@example.com,وبینار کانادا\n',
      {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="leads-sample.csv"',
        },
      },
    );
  }),

  http.post(`${BASE}/leads/import/preview/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return HttpResponse.json({ file: ['required'] }, { status: 400 });
    return HttpResponse.json(previewLeadImport(file.name, file.size, await file.text()));
  }),

  http.post(`${BASE}/leads/import/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const { token, seller } = (await request.json()) as LeadImportOptions;
    const work = leadImports.get(token);
    if (!work) return HttpResponse.json({ token: ['expired'] }, { status: 400 });
    leadImports.delete(token);
    let created = 0;
    let customers = 0;
    for (const item of work) {
      const known = KNOWN_PHONES.has(item.phone);
      if (!known) customers++;
      KNOWN_PHONES.set(item.phone, true);
      created++;
      // Leads for nobody wait in the queue, like Django's.
      if (seller === null)
        data.manager.queue.push({
          lead: 950 + data.manager.queue.length,
          customer: 600 + data.manager.queue.length,
          name: item.name || item.phone,
          degree: null,
          countries: [],
          cause: 'فرم سایت یا وبینار',
          score: 18,
          created_at: new Date().toISOString(),
          suggested: null,
        });
    }
    return HttpResponse.json({ created, new_customers: customers });
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
    const team = teamOf(range);
    return HttpResponse.json({
      ...team,
      sellers: team.sellers.map((seller) => ({
        ...seller,
        commission: commissionOf(seller.id, seller.won, seller.sales),
      })),
    });
  }),

  http.get(`${BASE}/commission/`, () => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    return HttpResponse.json({
      rules: commissionRules,
      sellers: [...SELLER_NAMES].map(([id, name]) => ({ id, name })),
    });
  }),

  http.post(`${BASE}/commission/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const body = (await request.json()) as CommissionRuleInput;
    const error = ruleError(body);
    if (error) return HttpResponse.json(error, { status: 400 });
    const rule: CommissionRule = {
      id: nextRule++,
      ...body,
      seller_name: body.seller === null ? null : (SELLER_NAMES.get(body.seller) ?? null),
      since: new Date().toISOString().slice(0, 10),
    };
    commissionRules.push(rule);
    return HttpResponse.json(rule, { status: 201 });
  }),

  http.put(`${BASE}/commission/:id/`, async ({ params, request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const index = commissionRules.findIndex((rule) => rule.id === Number(params.id));
    if (index < 0) return notFound();
    const body = (await request.json()) as CommissionRuleInput;
    const error = ruleError(body, Number(params.id));
    if (error) return HttpResponse.json(error, { status: 400 });
    const rule: CommissionRule = {
      ...(commissionRules[index] as CommissionRule),
      ...body,
      seller_name: body.seller === null ? null : (SELLER_NAMES.get(body.seller) ?? null),
    };
    commissionRules[index] = rule;
    return HttpResponse.json(rule);
  }),

  http.delete(`${BASE}/commission/:id/`, ({ params }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    if (!commissionRules.some((rule) => rule.id === Number(params.id))) return notFound();
    commissionRules = commissionRules.filter((rule) => rule.id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // S59: a seller's contracts in the range, and moving one (with a reason) to another seller.
  http.get(`${BASE}/team/contracts/`, ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const seller = Number(new URL(request.url).searchParams.get('seller'));
    if (!seller) return HttpResponse.json({ seller: ['Choose a seller.'] }, { status: 400 });
    const rows =
      seller === teamOf('month').sellers[0]?.id
        ? [
            {
              lead: 9001,
              customer: 122,
              name: 'سارا حیدری',
              title: 'پذیرش + ویزا · کانادا',
              amount: 120_000_000,
              amount_text: null,
              won_at: new Date().toISOString(),
              seller: teamOf('month').sellers[0]?.name ?? '',
              seller_id: seller,
              status: 'فعال',
            },
          ].filter((row) => !movedLeads.has(row.lead))
        : [];
    return HttpResponse.json(rows);
  }),
  http.post(`${BASE}/contracts/:lead/credit/`, async ({ params, request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const body = (await request.json()) as { seller?: number; reason?: string };
    if (!body.seller || !body.reason?.trim())
      return HttpResponse.json({ reason: ['Say why.'] }, { status: 400 });
    movedLeads.add(Number(params.lead));
    return new HttpResponse(null, { status: 204 });
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

  // S48: the team's board columns.
  http.get(`${BASE}/stages/`, () => {
    const data = managerOrError();
    return data instanceof Response ? data : HttpResponse.json(stagesOf(data.sales));
  }),

  http.put(`${BASE}/stages/`, async ({ request }) => {
    const data = managerOrError();
    if (data instanceof Response) return data;
    const body = (await request.json()) as {
      stages: StageInput[];
      moves: { source: number; to: number }[];
    };
    const error = saveStages(data.sales, body);
    return error
      ? HttpResponse.json({ stages: [error] }, { status: 400 })
      : HttpResponse.json(stagesOf(data.sales));
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
  movedLeads.clear();
  manager = null;
  commissionRules = freshRules();
  nextRule = 10;
  KNOWN_PHONES = knownPhones();
  leadImports.clear();
}
