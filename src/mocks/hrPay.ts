import { http, HttpResponse } from 'msw';
import type {
  Kpi,
  KpiCatalog,
  KpiResults,
  PayMonth,
  PayRule,
  PaySettings,
  Payroll,
  ResultDetail,
  ResultInput,
  Slip,
  SlipLine,
  Totals,
} from '@/features/hr/pay/api';
import { hrAllowed, payStaff } from './hr';
import { forbidden, notFound } from './session';

/**
 * Fake «حقوق و KPI» (lang `api/hr/v1/pay.py`, `kpi.py`, `human_resource/pay.py`): the sales rep
 * position (2) has two manual KPIs, «تماس موفق» (target 300, weight 3) and «قرارداد» (target 8,
 * weight 1); no values, no rules and no month of pay yet. Works scores, reward and penalty lines
 * and pay out the way Django does. An automatic KPI measures `MEASURED` for everyone (evidence
 * "8/10") when the month is measured again.
 */
const API = '/api/hr/v1';

interface MockSlip extends Pick<
  Slip,
  'addition' | 'addition_note' | 'deduction' | 'deduction_note'
> {
  id: number;
  staff: number;
}

interface MockMonth extends PayMonth {
  id: number;
  status: 'draft' | 'final';
  finalized_at: string | null;
  slips: MockSlip[];
}

function manualKpi(id: number, name: string, target: number, weight: number, unit: string): Kpi {
  return {
    id,
    name,
    metric: 'manual',
    params: {},
    direction: 'higher',
    target,
    worst: null,
    cap: 100,
    weight,
    unit,
    trial: false,
    scope: 'position',
    position: 2,
    team: null,
    staff: null,
  };
}

const DEFAULT_SETTINGS: PaySettings = {
  kpi_bonus_percent: 20,
  kpi_affects_pay: true,
  insurance_percent: 7,
  tax_brackets: [
    { upto: 24_000_000, rate: 0 },
    { upto: 30_000_000, rate: 10 },
    { upto: 38_000_000, rate: 15 },
    { upto: 50_000_000, rate: 20 },
    { upto: 66_666_667, rate: 25 },
    { upto: null, rate: 30 },
  ],
  penalty_cap_percent: 10,
};

const MEASURED = 80;

const CATALOG: KpiCatalog = {
  metrics: [
    {
      key: 'manual',
      label: 'ورود دستی',
      unit: '',
      direction: 'higher',
      group: 'manual',
      automatic: false,
    },
    {
      key: 'attendance.late_days',
      label: 'روزهای دیرکرد',
      unit: 'روز',
      direction: 'lower',
      group: 'attendance',
      automatic: true,
    },
    {
      key: 'tasks.on_time_percent',
      label: 'کارهای سر وقت',
      unit: '٪',
      direction: 'higher',
      group: 'tasks',
      automatic: true,
    },
  ],
  calculators: [{ key: 'sales.commission', label: 'پورسانت فروش' }],
};

interface MockResult {
  value: number;
  measured: number | null;
  source: ResultDetail['source'];
  note: string;
}

let nextId = 100;
let kpis: Kpi[] = [];
let rules: PayRule[] = [];
let results = new Map<string, MockResult>();
let settings: PaySettings = DEFAULT_SETTINGS;
let months: MockMonth[] = [];

export function resetHrPayMocks() {
  kpis = [manualKpi(1, 'تماس موفق', 300, 3, 'تماس'), manualKpi(2, 'قرارداد', 8, 1, 'قرارداد')];
  rules = [];
  results = new Map();
  settings = structuredClone(DEFAULT_SETTINGS);
  months = [];
}
resetHrPayMocks();

const resultKey = (month: PayMonth, staff: number, kpi: number) =>
  [month.year, month.month, staff, kpi].join(':');

function monthOf(url: string): PayMonth {
  const params = new URL(url).searchParams;
  return { year: Number(params.get('year')), month: Number(params.get('month')) };
}

type Person = ReturnType<typeof payStaff>[number];

function appliesTo(item: Pick<Kpi, 'scope' | 'position' | 'team' | 'staff'>, person: Person) {
  switch (item.scope) {
    case 'all':
      return true;
    case 'position':
      return item.position !== null && person.position?.id === item.position;
    case 'team':
      return item.team !== null && person.team === item.team;
    case 'person':
      return item.staff?.id === person.id;
  }
}

/** `KPI.part` in Django. */
function partOf(kpi: Kpi, value: number) {
  const worst = kpi.worst ?? 0;
  let part: number;
  if (kpi.direction === 'lower') {
    part =
      worst <= kpi.target ? (value <= kpi.target ? 1 : 0) : (worst - value) / (worst - kpi.target);
  } else {
    part =
      kpi.target <= worst ? (value >= kpi.target ? 1 : 0) : (value - worst) / (kpi.target - worst);
  }
  return Math.min(Math.max(part, 0), kpi.cap / 100);
}

function mine(month: PayMonth, person: Person) {
  const own = kpis.filter((kpi) => appliesTo(kpi, person));
  const values: Record<string, number> = {};
  const details: Record<string, ResultDetail> = {};
  for (const kpi of own) {
    const row = results.get(resultKey(month, person.id, kpi.id));
    if (!row) continue;
    values[String(kpi.id)] = row.value;
    details[String(kpi.id)] = {
      ...row,
      evidence: row.measured === null ? [] : ['8/10'],
      part: Math.round(partOf(kpi, row.value) * 1000) / 10,
    };
  }
  return { own, values, details };
}

function scoreOf(own: Kpi[], values: Record<string, number>) {
  let total = 0;
  let weights = 0;
  for (const kpi of own) {
    const value = values[String(kpi.id)];
    if (value === undefined || kpi.trial) continue;
    total += partOf(kpi, value) * kpi.weight;
    weights += kpi.weight;
  }
  return weights ? Math.round((total / weights) * 1000) / 10 : null;
}

/** `rule_lines` + `capped` in Django (calculators pay nothing here). */
function linesOf(month: PayMonth, person: Person, score: number | null): SlipLine[] {
  const lines: SlipLine[] = [];
  for (const rule of rules) {
    if (!appliesTo(rule, person) || rule.basis === 'calculator') continue;
    const value =
      rule.basis === 'score'
        ? score
        : (results.get(resultKey(month, person.id, rule.kpi ?? 0))?.value ?? null);
    if (value === null) continue;
    let amount =
      rule.method === 'steps'
        ? (rule.steps.find(
            (step) =>
              (step.from === null || value >= step.from) && (step.to === null || value < step.to),
          )?.amount ?? 0)
        : Math.max(value - rule.above, 0) * rule.amount;
    if (rule.amount_unit === 'percent') amount = (person.salary * amount) / 100;
    amount = Math.round(amount);
    if (amount)
      lines.push({
        label: rule.name,
        amount: rule.effect === 'penalty' ? -amount : amount,
        detail: String(value),
        trial: rule.trial,
      });
  }
  const penalties = -lines.reduce(
    (sum, line) => sum + (line.amount < 0 && !line.trial ? line.amount : 0),
    0,
  );
  const cap = settings.penalty_cap_percent;
  if (cap !== null && penalties > Math.round((person.salary * cap) / 100)) {
    const limit = Math.round((person.salary * cap) / 100);
    lines.push({
      label: 'سقف تنبیه',
      amount: penalties - limit,
      detail: `${String(cap)}%`,
      trial: false,
    });
  }
  return lines;
}

function incomeTax(taxable: number) {
  let tax = 0;
  let below = 0;
  for (const row of settings.tax_brackets) {
    const top = row.upto === null ? taxable : Math.min(taxable, row.upto);
    if (top > below) tax += ((top - below) * row.rate) / 100;
    if (row.upto === null || taxable <= row.upto) break;
    below = row.upto;
  }
  return Math.round(tax);
}

function slipOf(month: MockMonth, row: MockSlip): Slip | null {
  const person = payStaff().find((item) => item.id === row.staff);
  if (!person) return null;
  const { own, values } = mine(month, person);
  const score = scoreOf(own, values);
  const base = person.salary;
  const lines = linesOf(month, person, score);
  const adjustment = lines.reduce((sum, line) => sum + (line.trial ? 0 : line.amount), 0);
  const bonus =
    settings.kpi_affects_pay && score !== null
      ? Math.round((((base * settings.kpi_bonus_percent) / 100) * score) / 100)
      : 0;
  const gross = Math.max(base + bonus + row.addition + adjustment, 0);
  const insurance = person.insured ? Math.round((gross * settings.insurance_percent) / 100) : 0;
  const tax = incomeTax(Math.max(gross - insurance, 0));
  return {
    id: row.id,
    staff: { id: person.id, name: person.name, face: person.face },
    position: person.position?.name ?? null,
    personnel_code: person.personnel_code,
    insured: person.insured,
    base,
    kpi_score: score,
    kpi_bonus: bonus,
    addition: row.addition,
    addition_note: row.addition_note,
    adjustment,
    lines,
    gross,
    insurance,
    tax,
    deduction: row.deduction,
    deduction_note: row.deduction_note,
    net: gross - insurance - tax - row.deduction,
  };
}

const TOTALS: (keyof Totals)[] = [
  'base',
  'kpi_bonus',
  'addition',
  'adjustment',
  'gross',
  'insurance',
  'tax',
  'deduction',
  'net',
];

function payrollOf(month: PayMonth): Payroll {
  const row = months.find((item) => item.year === month.year && item.month === month.month);
  const slips = row ? row.slips.flatMap((slip) => slipOf(row, slip) ?? []) : [];
  const totals = Object.fromEntries(
    TOTALS.map((key) => [key, slips.reduce((sum, slip) => sum + slip[key], 0)]),
  ) as unknown as Totals;
  return {
    id: row?.id ?? null,
    year: month.year,
    month: month.month,
    status: row?.status ?? null,
    finalized_at: row?.finalized_at ?? null,
    finalized_by: row?.status === 'final' ? 'امیر عابدی' : null,
    slips,
    totals,
  };
}

const isFinal = (month: PayMonth) =>
  months.some(
    (row) => row.year === month.year && row.month === month.month && row.status === 'final',
  );

function resultsOf(month: PayMonth): KpiResults {
  return {
    ...month,
    final: isFinal(month),
    kpis,
    rows: payStaff().map((person) => {
      const { own, values, details } = mine(month, person);
      return {
        staff: { id: person.id, name: person.name, face: person.face },
        position: person.position?.id ?? null,
        kpis: own.map((kpi) => kpi.id),
        results: values,
        details,
        score: scoreOf(own, values),
        missing: own.filter((kpi) => !kpi.trial && values[String(kpi.id)] === undefined).length,
      };
    }),
  };
}

const finalConflict = () =>
  HttpResponse.json({ detail: "This month's pay is final." }, { status: 409 });

type KpiBody = Omit<Kpi, 'id' | 'staff' | 'params'> & { staff: number | null };
type RuleBody = Omit<PayRule, 'id' | 'staff'> & { staff: number | null };

const withStaff = <T extends { staff: number | null }>(body: T) => ({
  ...body,
  staff:
    body.staff === null
      ? null
      : { id: body.staff, name: payStaff().find((row) => row.id === body.staff)?.name ?? '' },
});

function measure(month: PayMonth) {
  for (const person of payStaff()) {
    for (const kpi of kpis) {
      if (kpi.metric === 'manual' || !appliesTo(kpi, person)) continue;
      const key = resultKey(month, person.id, kpi.id);
      const row = results.get(key);
      if (row?.source === 'override') row.measured = MEASURED;
      else results.set(key, { value: MEASURED, measured: MEASURED, source: 'auto', note: '' });
    }
  }
}

export const hrPayHandlers = [
  http.get(`${API}/kpi-catalog/`, () => (hrAllowed() ? HttpResponse.json(CATALOG) : forbidden())),
  http.get(`${API}/kpis/`, () => (hrAllowed() ? HttpResponse.json({ kpis }) : forbidden())),
  http.post(`${API}/kpis/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    const kpi: Kpi = { params: {}, ...withStaff((await request.json()) as KpiBody), id: ++nextId };
    kpis.push(kpi);
    return HttpResponse.json(kpi, { status: 201 });
  }),
  http.put(`${API}/kpis/:id/`, async ({ params, request }) => {
    if (!hrAllowed()) return forbidden();
    const kpi = kpis.find((row) => row.id === Number(params.id));
    if (!kpi) return notFound();
    Object.assign(kpi, withStaff((await request.json()) as KpiBody));
    return HttpResponse.json(kpi);
  }),
  http.delete(`${API}/kpis/:id/`, ({ params }) => {
    if (!hrAllowed()) return forbidden();
    kpis = kpis.filter((row) => row.id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/kpi-results/`, ({ request }) =>
    hrAllowed() ? HttpResponse.json(resultsOf(monthOf(request.url))) : forbidden(),
  ),
  http.put(`${API}/kpi-results/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    const body = (await request.json()) as PayMonth & { results: ResultInput[] };
    if (isFinal(body)) return finalConflict();
    for (const row of body.results) {
      const key = resultKey(body, row.staff, row.kpi);
      const manual = kpis.find((kpi) => kpi.id === row.kpi)?.metric === 'manual';
      const saved = results.get(key);
      if (manual) {
        if (row.result === null) results.delete(key);
        else results.set(key, { value: row.result, measured: null, source: 'manual', note: '' });
      } else if (row.result === null) {
        if (saved?.measured != null)
          results.set(key, {
            value: saved.measured,
            measured: saved.measured,
            source: 'auto',
            note: '',
          });
      } else {
        if (!row.note?.trim()) return HttpResponse.json({ note: ['Say why.'] }, { status: 400 });
        results.set(key, {
          value: row.result,
          measured: saved?.measured ?? null,
          source: 'override',
          note: row.note.trim(),
        });
      }
    }
    return HttpResponse.json(resultsOf(body));
  }),
  http.post(`${API}/kpi-results/refresh/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    const month = (await request.json()) as PayMonth;
    if (isFinal(month)) return finalConflict();
    measure(month);
    return HttpResponse.json(resultsOf(month));
  }),
  http.get(`${API}/pay-rules/`, () => (hrAllowed() ? HttpResponse.json({ rules }) : forbidden())),
  http.post(`${API}/pay-rules/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    const rule: PayRule = { ...withStaff((await request.json()) as RuleBody), id: ++nextId };
    rules.push(rule);
    return HttpResponse.json(rule, { status: 201 });
  }),
  http.put(`${API}/pay-rules/:id/`, async ({ params, request }) => {
    if (!hrAllowed()) return forbidden();
    const rule = rules.find((row) => row.id === Number(params.id));
    if (!rule) return notFound();
    Object.assign(rule, withStaff((await request.json()) as RuleBody));
    return HttpResponse.json(rule);
  }),
  http.delete(`${API}/pay-rules/:id/`, ({ params }) => {
    if (!hrAllowed()) return forbidden();
    rules = rules.filter((row) => row.id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/pay-settings/`, () => (hrAllowed() ? HttpResponse.json(settings) : forbidden())),
  http.put(`${API}/pay-settings/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    settings = (await request.json()) as PaySettings;
    return HttpResponse.json(settings);
  }),
  http.get(`${API}/payroll/`, ({ request }) =>
    hrAllowed() ? HttpResponse.json(payrollOf(monthOf(request.url))) : forbidden(),
  ),
  http.post(`${API}/payroll/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    const month = (await request.json()) as PayMonth;
    if (isFinal(month)) return finalConflict();
    let row = months.find((item) => item.year === month.year && item.month === month.month);
    if (!row) {
      row = { ...month, id: ++nextId, status: 'draft', finalized_at: null, slips: [] };
      months.push(row);
    }
    const kept = new Map(row.slips.map((slip) => [slip.staff, slip]));
    row.slips = payStaff().map(
      (person) =>
        kept.get(person.id) ?? {
          id: ++nextId,
          staff: person.id,
          addition: 0,
          addition_note: '',
          deduction: 0,
          deduction_note: '',
        },
    );
    return HttpResponse.json(payrollOf(month));
  }),
  http.post(`${API}/payroll/:id/final/`, ({ params }) => {
    if (!hrAllowed()) return forbidden();
    const row = months.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    if (row.status === 'final') return finalConflict();
    row.status = 'final';
    row.finalized_at = new Date().toISOString();
    return HttpResponse.json(payrollOf(row));
  }),
  http.patch(`${API}/payslips/:id/`, async ({ params, request }) => {
    if (!hrAllowed()) return forbidden();
    const month = months.find((item) => item.slips.some((slip) => slip.id === Number(params.id)));
    const slip = month?.slips.find((item) => item.id === Number(params.id));
    if (!month || !slip) return notFound();
    if (month.status === 'final') return finalConflict();
    Object.assign(slip, (await request.json()) as Partial<MockSlip>);
    const row = slipOf(month, slip);
    return row
      ? HttpResponse.json({ ...row, year: month.year, month: month.month, status: month.status })
      : notFound();
  }),
];
