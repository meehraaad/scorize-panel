import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { fromCalendar, toCalendar } from '@/lib/calendar';
import type { Face } from '@/lib/face/api';
import { HR_API, HR_KEY } from '../api';

/**
 * «حقوق و KPI»: the KPIs (for everyone, a position, a team or one person; measured by the system
 * or entered by hand), the month's values, the reward and penalty rules, how pay is worked out
 * (KPI bonus, penalty cap, insurance, tax brackets) and a month's pay with its slips. Django:
 * `api/hr/v1/` (`kpi.py`, `pay.py`; lang `human_resource/pay.py`, `metrics.py`, `calculators.py`). Months are Persian (`year`, `month` 1–12) whatever the user's
 * calendar; a final month's slips and results no longer change.
 */
export const PAY_KEY = [...HR_KEY, 'pay'] as const;

export interface PayMonth {
  year: number;
  month: number;
}

/** The Persian month `shift` months from this one. */
export function payMonth(shift = 0): PayMonth {
  const today = toCalendar(new Date(), 'persian');
  const index = today.year * 12 + (today.month - 1) + shift;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The month's first day, for naming it in the user's language. */
export const firstDayOf = ({ year, month }: PayMonth) =>
  fromCalendar({ year, month, day: 1 }, 'persian');

export const monthQuery = ({ year, month }: PayMonth) =>
  `year=${String(year)}&month=${String(month)}`;

export type Scope = 'all' | 'position' | 'team' | 'person';

/** Who a KPI or a pay rule is for. */
export interface Scoped {
  scope: Scope;
  position: number | null;
  /** A team's name (`teams` in the HR options). */
  team: string | null;
  staff: { id: number; name: string } | null;
}

export type Direction = 'higher' | 'lower';

export interface Kpi extends Scoped {
  id: number;
  name: string;
  /** Who measures it (`kpi-catalog`); `manual`: entered by hand. */
  metric: string;
  params: Record<string, unknown>;
  direction: Direction;
  /** Reaching it is 100%. */
  target: number;
  /** The value worth 0%; null: 0. */
  worst: number | null;
  /** The most a KPI can score, in percent. */
  cap: number;
  weight: number;
  unit: string;
  /** Shown, but not counted in the score (nor pay) yet. */
  trial: boolean;
}

export interface Metric {
  key: string;
  label: string;
  unit: string;
  direction: Direction;
  group: string;
  automatic: boolean;
}

export interface Calculator {
  key: string;
  label: string;
}

export interface KpiCatalog {
  metrics: Metric[];
  calculators: Calculator[];
}

export const MANUAL = 'manual';

export interface PersonRef {
  id: number;
  name: string;
  face: Face | null;
}

export interface ResultDetail {
  value: number;
  /** What the system measured; null for a manual KPI. */
  measured: number | null;
  /** `override`: measured, then changed by hand (`note` says why). */
  source: 'manual' | 'auto' | 'override';
  note: string;
  /** A few words behind a measured value (late days, "12/14"). */
  evidence: string[];
  /** The KPI's score for this value, in percent. */
  part: number | null;
}

export interface ResultRow {
  staff: PersonRef;
  position: number | null;
  /** The KPIs that apply to this person this month. */
  kpis: number[];
  /** KPI id → result. */
  results: Record<string, number>;
  details: Record<string, ResultDetail>;
  /** Percent; null with no result yet. */
  score: number | null;
  /** The position's KPIs with no result. */
  missing: number;
}

export type DisputeStatus = 'open' | 'accepted' | 'rejected';

/** A person's objection to one of their values in a closed month, and HR's answer. */
export interface Dispute {
  id: number;
  staff: PersonRef;
  kpi: { id: number; name: string; unit: string };
  text: string;
  /** The value objected to. */
  value: number | null;
  status: DisputeStatus;
  answer: string;
  /** The value it was changed to, when accepted with one. */
  new_value: number | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

/**
 * A month closed for review: no longer measured, and people can object until `disputes_until`
 * (a date, inclusive). Pay can't be made final while an objection is open.
 */
export interface MonthReview {
  closed: boolean;
  closed_at: string | null;
  closed_by: string | null;
  disputes_until: string | null;
}

export interface KpiResults extends PayMonth, MonthReview {
  /** The month's pay is final: results no longer change. */
  final: boolean;
  disputes: Dispute[];
  kpis: Kpi[];
  rows: ResultRow[];
}

export interface TaxBracket {
  /** The top of the bracket in Tomans; null: everything above. */
  upto: number | null;
  rate: number;
}

export interface PaySettings {
  kpi_bonus_percent: number;
  kpi_affects_pay: boolean;
  insurance_percent: number;
  tax_brackets: TaxBracket[];
  /** The most penalties take in a month, in percent of the base; null: no cap. */
  penalty_cap_percent: number | null;
}

export type Effect = 'reward' | 'penalty';
export type Basis = 'score' | 'kpi' | 'calculator';

export interface RuleStep {
  /** null: from anything. */
  from: number | null;
  /** Not included; null: no limit. */
  to: number | null;
  amount: number;
}

export interface PayRule extends Scoped {
  id: number;
  name: string;
  effect: Effect;
  /** What it reads: the KPI score (percent), one KPI's value, or a calculator's amount. */
  basis: Basis;
  kpi: number | null;
  calculator: string;
  method: 'steps' | 'per_unit';
  steps: RuleStep[];
  /** `per_unit`: for each unit above `above`. */
  amount: number;
  above: number;
  amount_unit: 'toman' | 'percent';
  /** A team's (or everyone's) value together, the same for all of them. */
  pooled: boolean;
  /** Shown on the slip, not paid. */
  trial: boolean;
}

export interface SlipLine {
  label: string;
  /** Plus: a reward; minus: a penalty. */
  amount: number;
  detail: string;
  trial: boolean;
}

export interface Slip {
  id: number;
  staff: PersonRef;
  position: string | null;
  personnel_code: string;
  insured: boolean;
  base: number;
  kpi_score: number | null;
  kpi_bonus: number;
  addition: number;
  addition_note: string;
  /** The month's rewards less penalties (trial lines left out). */
  adjustment: number;
  lines: SlipLine[];
  gross: number;
  insurance: number;
  tax: number;
  deduction: number;
  deduction_note: string;
  net: number;
}

export type Totals = Pick<
  Slip,
  | 'base'
  | 'kpi_bonus'
  | 'addition'
  | 'adjustment'
  | 'gross'
  | 'insurance'
  | 'tax'
  | 'deduction'
  | 'net'
>;

export interface Payroll extends PayMonth {
  /** null: the month's pay isn't started. */
  id: number | null;
  status: 'draft' | 'final' | null;
  finalized_at: string | null;
  finalized_by: string | null;
  slips: Slip[];
  totals: Totals;
}

export interface SlipDetail extends Slip, PayMonth {
  status: 'draft' | 'final';
}

export const kpisQuery = queryOptions({
  queryKey: [...PAY_KEY, 'kpis'],
  queryFn: ({ signal }) => api<{ kpis: Kpi[] }>(`${HR_API}/kpis/`, { signal }),
});

export const catalogQuery = queryOptions({
  queryKey: [...PAY_KEY, 'catalog'],
  queryFn: ({ signal }) => api<KpiCatalog>(`${HR_API}/kpi-catalog/`, { signal }),
  staleTime: 5 * 60_000,
});

export const rulesQuery = queryOptions({
  queryKey: [...PAY_KEY, 'rules'],
  queryFn: ({ signal }) => api<{ rules: PayRule[] }>(`${HR_API}/pay-rules/`, { signal }),
});

export const resultsQuery = (month: PayMonth) =>
  queryOptions({
    queryKey: [...PAY_KEY, 'results', month.year, month.month],
    queryFn: ({ signal }) =>
      api<KpiResults>(`${HR_API}/kpi-results/?${monthQuery(month)}`, { signal }),
  });

export const paySettingsQuery = queryOptions({
  queryKey: [...PAY_KEY, 'settings'],
  queryFn: ({ signal }) => api<PaySettings>(`${HR_API}/pay-settings/`, { signal }),
});

export const payrollQuery = (month: PayMonth) =>
  queryOptions({
    queryKey: [...PAY_KEY, 'payroll', month.year, month.month],
    queryFn: ({ signal }) => api<Payroll>(`${HR_API}/payroll/?${monthQuery(month)}`, { signal }),
  });

export type KpiInput = Omit<Kpi, 'id' | 'staff' | 'params'> & { staff: number | null };

export interface ResultInput {
  staff: number;
  kpi: number;
  /** null: remove a manual value, or go back to the measured one. */
  result: number | null;
  /** Why a measured value changes. */
  note?: string;
}

export interface AnswerInput {
  id: number;
  accept: boolean;
  answer: string;
  /** Accepting with a value changes the person's value to it. */
  value: number | null;
}

export type RuleInput = Omit<PayRule, 'id' | 'staff'> & { staff: number | null };
