import { http, HttpResponse } from 'msw';
import type {
  Kpi,
  KpiResults,
  PayMonth,
  PaySettings,
  Payroll,
  Slip,
  Totals,
} from '@/features/hr/pay/api';
import { hrAllowed, payStaff } from './hr';
import { forbidden, notFound } from './session';

/**
 * Fake «حقوق و KPI» (lang `api/hr/v1/pay.py`, `human_resource/pay.py`): the sales rep position
 * (2) has two KPIs, «تماس موفق» (target 300, weight 3) and «قرارداد» (target 8, weight 1); no
 * results and no month of pay yet. Works pay out the way Django does.
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
};

let nextId = 100;
let kpis: Kpi[] = [];
let results = new Map<string, number>();
let settings: PaySettings = DEFAULT_SETTINGS;
let months: MockMonth[] = [];

export function resetHrPayMocks() {
  kpis = [
    { id: 1, name: 'تماس موفق', position: 2, target: 300, weight: 3, unit: 'تماس' },
    { id: 2, name: 'قرارداد', position: 2, target: 8, weight: 1, unit: 'قرارداد' },
  ];
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

function mine(month: PayMonth, staff: number, position: number | null) {
  const own = kpis.filter((kpi) => kpi.position === position);
  const values: Record<string, number> = {};
  for (const kpi of own) {
    const value = results.get(resultKey(month, staff, kpi.id));
    if (value !== undefined) values[String(kpi.id)] = value;
  }
  return { own, values };
}

function scoreOf(own: Kpi[], values: Record<string, number>) {
  let total = 0;
  let weights = 0;
  for (const kpi of own) {
    const value = values[String(kpi.id)];
    if (value === undefined) continue;
    total += (kpi.target <= 0 ? 1 : Math.min(Math.max(value / kpi.target, 0), 1)) * kpi.weight;
    weights += kpi.weight;
  }
  return weights ? Math.round((total / weights) * 1000) / 10 : null;
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
  const { own, values } = mine(month, person.id, person.position?.id ?? null);
  const score = scoreOf(own, values);
  const base = person.salary;
  const bonus =
    settings.kpi_affects_pay && score !== null
      ? Math.round((((base * settings.kpi_bonus_percent) / 100) * score) / 100)
      : 0;
  const gross = base + bonus + row.addition;
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
      const { own, values } = mine(month, person.id, person.position?.id ?? null);
      return {
        staff: { id: person.id, name: person.name, face: person.face },
        position: person.position?.id ?? null,
        results: values,
        score: scoreOf(own, values),
        missing: own.length - Object.keys(values).length,
      };
    }),
  };
}

const finalConflict = () =>
  HttpResponse.json({ detail: "This month's pay is final." }, { status: 409 });

export const hrPayHandlers = [
  http.get(`${API}/kpis/`, () => (hrAllowed() ? HttpResponse.json({ kpis }) : forbidden())),
  http.post(`${API}/kpis/`, async ({ request }) => {
    if (!hrAllowed()) return forbidden();
    const kpi = { ...((await request.json()) as Omit<Kpi, 'id'>), id: ++nextId };
    kpis.push({ ...kpi, unit: kpi.unit || '' });
    return HttpResponse.json(kpi, { status: 201 });
  }),
  http.put(`${API}/kpis/:id/`, async ({ params, request }) => {
    if (!hrAllowed()) return forbidden();
    const kpi = kpis.find((row) => row.id === Number(params.id));
    if (!kpi) return notFound();
    Object.assign(kpi, (await request.json()) as Omit<Kpi, 'id'>);
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
    const body = (await request.json()) as PayMonth & {
      results: { staff: number; kpi: number; result: number | null }[];
    };
    if (isFinal(body)) return finalConflict();
    for (const row of body.results) {
      const key = resultKey(body, row.staff, row.kpi);
      if (row.result === null) results.delete(key);
      else results.set(key, row.result);
    }
    return HttpResponse.json(resultsOf(body));
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
