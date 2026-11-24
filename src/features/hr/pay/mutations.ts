import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { HR_API } from '../api';
import {
  PAY_KEY,
  type PayMonth,
  monthQuery,
  type Kpi,
  type KpiResults,
  type PaySettings,
  type PayRule,
  type Slip,
  type Payroll,
  type SlipDetail,
  type KpiInput,
  type ResultInput,
  type AnswerInput,
  type RuleInput,
  type Plan,
  type PlanInput,
  type HandKind,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Every pay write can change the slips and scores: the whole section follows. */
function usePayMutation<V, T>(send: (value: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => client.invalidateQueries({ queryKey: PAY_KEY }),
  });
}

export const useSaveKpi = () =>
  usePayMutation(({ id, ...body }: KpiInput & { id?: number }) =>
    id === undefined
      ? api<Kpi>(`${HR_API}/kpis/`, { method: 'POST', body })
      : api<Kpi>(`${HR_API}/kpis/${String(id)}/`, { method: 'PUT', body }),
  );

export const useRemoveKpi = () =>
  usePayMutation((id: number) => api(`${HR_API}/kpis/${String(id)}/`, { method: 'DELETE' }));

export const useSaveResults = () =>
  usePayMutation((body: PayMonth & { results: ResultInput[] }) =>
    api<KpiResults>(`${HR_API}/kpi-results/`, { method: 'PUT', body }),
  );

export const useRefreshResults = () =>
  usePayMutation((body: PayMonth) =>
    api<KpiResults>(`${HR_API}/kpi-results/refresh/`, { method: 'POST', body }),
  );

export const useCloseMonth = () =>
  usePayMutation((body: PayMonth & { days: number }) =>
    api<KpiResults>(`${HR_API}/kpi-months/close/`, { method: 'POST', body }),
  );

export const useReopenMonth = () =>
  usePayMutation((month: PayMonth) =>
    api<KpiResults>(`${HR_API}/kpi-months/close/?${monthQuery(month)}`, { method: 'DELETE' }),
  );

export const useAnswerDispute = () =>
  usePayMutation(({ id, ...body }: AnswerInput) =>
    api<KpiResults>(`${HR_API}/kpi-disputes/${String(id)}/answer/`, { method: 'POST', body }),
  );

export const useSaveRule = () =>
  usePayMutation(({ id, ...body }: RuleInput & { id?: number }) =>
    id === undefined
      ? api<PayRule>(`${HR_API}/pay-rules/`, { method: 'POST', body })
      : api<PayRule>(`${HR_API}/pay-rules/${String(id)}/`, { method: 'PUT', body }),
  );

export const useRemoveRule = () =>
  usePayMutation((id: number) => api(`${HR_API}/pay-rules/${String(id)}/`, { method: 'DELETE' }));

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

export const useSavePlan = () =>
  usePayMutation((body: PlanInput) => api<Plan>(`${HR_API}/kpi-plans/`, { method: 'PUT', body }));

export const useAddSlipLine = (slip: number) =>
  usePayMutation((body: { kind: HandKind; amount: number; note: string }) =>
    api<SlipDetail>(`${HR_API}/payslips/${String(slip)}/lines/`, { method: 'POST', body }),
  );

export const useRemoveSlipLine = () =>
  usePayMutation((id: number) =>
    api<SlipDetail>(`${HR_API}/payslip-lines/${String(id)}/`, { method: 'DELETE' }),
  );

/** A paid month's slip is corrected on the person's slip of the month after. */
export const useCorrectSlip = (slip: number) =>
  usePayMutation((body: { amount: number; note: string }) =>
    api<SlipDetail>(`${HR_API}/payslips/${String(slip)}/correction/`, { method: 'POST', body }),
  );

/** Shows a month to staff: closes its values for objections and works its pay out. */
export const useShowMonth = () =>
  usePayMutation(async (month: PayMonth) => {
    await api<KpiResults>(`${HR_API}/kpi-months/close/`, { method: 'POST', body: month });
    return api<Payroll>(`${HR_API}/payroll/`, { method: 'POST', body: month });
  });
