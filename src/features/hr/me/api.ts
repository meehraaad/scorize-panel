import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toCalendar } from '@/lib/calendar';
import type { DisputeStatus, Kpi, PayMonth, ResultDetail, SlipLine } from '../pay/api';

/**
 * «من»: a staff member's own KPIs and pay, open to anyone with an active staff file. Django:
 * `api/hr/v1/me/` (lang `api/hr/v1/me.py`).
 */
export const ME_KEY = ['me', 'kpis'] as const;

export interface MyKpi extends Pick<
  Kpi,
  'id' | 'name' | 'metric' | 'direction' | 'target' | 'worst' | 'weight' | 'unit' | 'trial'
> {
  /** null: no value yet. */
  detail: ResultDetail | null;
}

export interface MyDispute {
  id: number;
  kpi: number;
  text: string;
  value: number | null;
  status: DisputeStatus;
  answer: string;
  new_value: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MySlip {
  base: number;
  kpi_bonus: number;
  addition: number;
  adjustment: number;
  gross: number;
  insurance: number;
  tax: number;
  deduction: number;
  net: number;
}

export interface MyMonth extends PayMonth {
  /** Worked here that month. */
  worked: boolean;
  /** The month's pay is final: `lines` are the slip's and `slip` is set. */
  final: boolean;
  /** Closed for review: values no longer measured. */
  closed: boolean;
  disputes_until: string | null;
  /** I can object to a value now. */
  can_object: boolean;
  kpis: MyKpi[];
  score: number | null;
  /** Rewards and penalties: with today's values until the month is final. */
  lines: SlipLine[];
  slip: MySlip | null;
  disputes: MyDispute[];
}

const monthQuery = ({ year, month }: PayMonth) => `year=${String(year)}&month=${String(month)}`;

/** This Persian month (kept here, not imported from the HR panel: the route is in the main bundle). */
export function thisMonth(): PayMonth {
  const today = toCalendar(new Date(), 'persian');
  return { year: today.year, month: today.month };
}

export const myMonthQuery = (month: PayMonth) =>
  queryOptions({
    queryKey: [...ME_KEY, month.year, month.month],
    queryFn: ({ signal }) => api<MyMonth>(`/hr/v1/me/kpis/?${monthQuery(month)}`, { signal }),
  });

export function useObject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PayMonth & { kpi: number; text: string }) =>
      api<MyMonth>(`/hr/v1/me/disputes/`, { method: 'POST', body }),
    onSuccess: (data) => {
      client.setQueryData(myMonthQuery(data).queryKey, data);
      // HR's «نتیجه‌ها» lists objections (the same person may be HR).
      void client.invalidateQueries({ queryKey: ['hr', 'pay'] });
    },
  });
}
