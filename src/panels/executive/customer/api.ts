import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { EXECUTIVE_API, EXECUTIVE_KEY } from '@/features/executive/api';
import type { CustomerInfo, InfoSource } from '@/features/sales/api/info';
import { caseKey, type CaseData } from '@/features/supervisor/api/case';
import { SUPERVISOR_KEY } from '@/features/supervisor/api/common';
import type { CaseService } from '@/features/supervisor/api/services';
import { ApiError, api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import type { WritingDepartment } from '@/lib/tickets/api';
import type { WorkItem } from '@/features/executive/api';
import { TASKS_KEY } from '@/lib/tasks/api';

export const CONTRACT_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'terminated',
  'on_hold',
  'finished',
  'end_of_contract',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface ContractState {
  status: ContractStatus;
  termination_reason: string | null;
}

export interface CustomerTask {
  id: number;
  text: string;
  status: string;
  due_at: string;
  done_at: string | null;
  can_complete: boolean;
}

export interface CustomerWorkspace {
  id: number;
  name: string;
  case: CaseData | null;
  services: CaseService[];
  service_tabs: number[];
  writing: {
    id: number;
    kind: WritingDepartment;
    state: Extract<WorkItem, { case: null }>['status'];
  }[];
  next_task: CustomerTask | null;
  open_tasks: number;
  contract_state: ContractState | null;
  can_change_contract: boolean;
  can_edit_information: boolean;
}

export interface CustomerPayment {
  id: number;
  amount: number;
  status: string;
  at: string;
  receipt: string | null;
  items: string[];
}

export const workspaceKey = (id: number) => [...EXECUTIVE_KEY, 'customer-workspace', id] as const;
const customerApi = (id: number) => `${EXECUTIVE_API}/customers/${String(id)}`;

export const workspaceQuery = (id: number) =>
  queryOptions({
    queryKey: workspaceKey(id),
    queryFn: async ({ signal }): Promise<CustomerWorkspace | null> => {
      try {
        return await api<CustomerWorkspace>(`${customerApi(id)}/workspace/`, { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

export const financeQuery = (id: number) =>
  queryOptions({
    queryKey: [...workspaceKey(id), 'finance'],
    queryFn: ({ signal }) =>
      api<{ payments: CustomerPayment[]; purchases: CustomerPayment[] }>(
        `${customerApi(id)}/finance/`,
        { signal },
      ),
  });

export const workspaceInfoSource = (id: number): InfoSource => ({
  endpoint: `${customerApi(id)}/information/`,
  queryKey: [...workspaceKey(id), 'information'],
});

export const workspaceInfoQuery = (id: number) => {
  const { endpoint, queryKey } = workspaceInfoSource(id);
  return queryOptions({
    queryKey,
    queryFn: ({ signal }) => api<CustomerInfo>(endpoint, { signal }),
  });
};

export type TaskState = 'open' | 'completed';

export const customerTasksQuery = (id: number, state: TaskState, page: number) =>
  queryOptions({
    queryKey: [...TASKS_KEY, 'executive-customer', id, state, page],
    queryFn: ({ signal }) =>
      api<Page<CustomerTask> & { open: number; completed: number }>(
        `${customerApi(id)}/tasks/?state=${state}&page=${String(page)}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });

export function useChangeContractStatus(id: number) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (state: ContractState) =>
      api<ContractState>(`${customerApi(id)}/contract-status/`, {
        method: 'PATCH',
        body: state,
      }),
    onSuccess: (contract_state) => {
      cache.setQueryData(
        workspaceQuery(id).queryKey,
        (previous) => previous && { ...previous, contract_state },
      );
      void cache.invalidateQueries({ queryKey: EXECUTIVE_KEY });
      void cache.invalidateQueries({ queryKey: SUPERVISOR_KEY });
    },
  });
}

export function useRefreshCustomerWorkspace(id: number, caseId?: number) {
  const cache = useQueryClient();
  return () => {
    void cache.invalidateQueries({ queryKey: workspaceKey(id) });
    if (caseId) void cache.invalidateQueries({ queryKey: caseKey(caseId) });
  };
}

export const REPORT_PERIODS = ['all', 'month', 'quarter'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

interface CustomerReport {
  services: {
    id: number;
    name: string;
    owner: string | null;
    stage: string | null;
    progress: number | null;
  }[];
  answered: number;
  waiting: number;
  slow: number;
}

export const customerReportQuery = (id: number, period: ReportPeriod = 'all') =>
  queryOptions({
    queryKey: [...workspaceKey(id), 'report', period],
    queryFn: ({ signal }) =>
      api<CustomerReport>(`${customerApi(id)}/report/?period=${period}`, { signal }),
    placeholderData: keepPreviousData,
  });
