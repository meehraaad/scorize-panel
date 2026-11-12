import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { fromCalendar, toCalendar } from '@/lib/calendar';
import type { Face } from '@/lib/face/api';
import { HR_API, HR_KEY } from '../api';

/**
 * «حقوق و KPI»: each position's KPIs, the month's KPI results, how pay is worked out (KPI bonus,
 * insurance, tax brackets) and a month's pay with its slips. Django: `api/hr/v1/` (`pay.py`,
 * lang `human_resource/pay.py`). Months are Persian (`year`, `month` 1–12) whatever the user's
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

const monthQuery = ({ year, month }: PayMonth) => `year=${String(year)}&month=${String(month)}`;

export interface Kpi {
  id: number;
  name: string;
  position: number;
  /** Reaching it (or more) is 100%. */
  target: number;
  weight: number;
  unit: string;
}

export interface PersonRef {
  id: number;
  name: string;
  face: Face | null;
}

export interface ResultRow {
  staff: PersonRef;
  position: number | null;
  /** KPI id → result. */
  results: Record<string, number>;
  /** Percent; null with no result yet. */
  score: number | null;
  /** The position's KPIs with no result. */
  missing: number;
}

export interface KpiResults extends PayMonth {
  /** The month's pay is final: results no longer change. */
  final: boolean;
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
  gross: number;
  insurance: number;
  tax: number;
  deduction: number;
  deduction_note: string;
  net: number;
}

export type Totals = Pick<
  Slip,
  'base' | 'kpi_bonus' | 'addition' | 'gross' | 'insurance' | 'tax' | 'deduction' | 'net'
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

/** Every pay write can change the slips and scores: the whole section follows. */
function usePayMutation<V, T>(send: (value: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => client.invalidateQueries({ queryKey: PAY_KEY }),
  });
}

export type KpiInput = Omit<Kpi, 'id'>;

export const useSaveKpi = () =>
  usePayMutation(({ id, ...body }: KpiInput & { id?: number }) =>
    id === undefined
      ? api<Kpi>(`${HR_API}/kpis/`, { method: 'POST', body })
      : api<Kpi>(`${HR_API}/kpis/${String(id)}/`, { method: 'PUT', body }),
  );

export const useRemoveKpi = () =>
  usePayMutation((id: number) => api(`${HR_API}/kpis/${String(id)}/`, { method: 'DELETE' }));

export const useSaveResults = () =>
  usePayMutation(
    (body: PayMonth & { results: { staff: number; kpi: number; result: number | null }[] }) =>
      api<KpiResults>(`${HR_API}/kpi-results/`, { method: 'PUT', body }),
  );

export const useSavePaySettings = () =>
  usePayMutation((body: PaySettings) =>
    api<PaySettings>(`${HR_API}/pay-settings/`, { method: 'PUT', body }),
  );

export const useStartPayroll = () =>
  usePayMutation((body: PayMonth) => api<Payroll>(`${HR_API}/payroll/`, { method: 'POST', body }));

export const useFinalPayroll = () =>
  usePayMutation((id: number) =>
    api<Payroll>(`${HR_API}/payroll/${String(id)}/final/`, { method: 'POST' }),
  );

export const useEditSlip = (id: number) =>
  usePayMutation(
    (body: Partial<Pick<Slip, 'addition' | 'addition_note' | 'deduction' | 'deduction_note'>>) =>
      api<SlipDetail>(`${HR_API}/payslips/${String(id)}/`, { method: 'PATCH', body }),
  );
