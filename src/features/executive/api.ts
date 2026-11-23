import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import type { WritingDepartment } from '@/lib/tickets/api';

export const EXECUTIVE_API = '/executive/v1';
export const EXECUTIVE_KEY = ['executive'] as const;

export interface ServiceCount {
  key: string;
  name: string | null;
  active: number;
  total: number;
}

interface Overview {
  services: ServiceCount[];
  writing_waiting: number;
}

export type WorkItem = { id: number; kind: string; detail: string | null } & (
  | { case: number; name: string; status: 'open' | 'paused' | 'closed' }
  | {
      case: null;
      name: WritingDepartment;
      status: 'new' | 'drafting' | 'revision' | 'waiting_applicant' | 'delivered';
    }
);

export interface WorkCustomer {
  id: number;
  name: string;
  items: WorkItem[];
}

export const overviewQuery = queryOptions({
  queryKey: [...EXECUTIVE_KEY, 'overview'],
  queryFn: ({ signal }) => api<Overview>(`${EXECUTIVE_API}/overview/`, { signal }),
});

export function workQuery(search: URLSearchParams) {
  const params = new URLSearchParams();
  for (const key of ['service', 'customer', 'page']) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  return queryOptions({
    queryKey: [...EXECUTIVE_KEY, 'work', params.toString()],
    queryFn: ({ signal }) =>
      api<Page<WorkCustomer>>(`${EXECUTIVE_API}/work/?${params.toString()}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function workPath(search = new URLSearchParams()) {
  return search.size ? `/executive/work?${search.toString()}` : '/executive/work';
}
