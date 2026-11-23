import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { API_BASE, api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { CASE_STAGES, type DocCount } from '@/features/supervisor/api/common';
import { EXECUTIVE_API, EXECUTIVE_KEY, overviewQuery, workQuery } from '@/features/executive/api';

export const CUSTOMER_STAGES = [...CASE_STAGES, 'emailing'] as const;
export const CUSTOMER_SCOPES = ['mine', 'team', 'all'] as const;
export const CUSTOMER_QUEUES = ['today', 'late', 'review', 'reply', 'unassigned'] as const;
export const CUSTOMER_ORDERS = ['next_task', 'recent_activity', 'name'] as const;

type Scope = (typeof CUSTOMER_SCOPES)[number];
type Queue = (typeof CUSTOMER_QUEUES)[number];
export type EmailState = 'on' | 'off' | 'waiting';
type Option = { value: string; label: string };

export interface CustomerCase {
  id: number;
  name: string;
  case_id: number | null;
  file_number: number | null;
  contract: string | null;
  services: {
    id: number;
    name: string;
    owner: { name: string; mine: boolean } | null;
  }[];
  stage: (typeof CUSTOMER_STAGES)[number] | null;
  next_task: { title: string; due_at: string | null; urgency: 'today' | 'late' | null } | null;
  docs: (DocCount & { review: number }) | null;
  email: EmailState | null;
  last_activity: string | null;
}

interface CustomerList extends Page<CustomerCase> {
  scopes: Partial<Record<Scope, number>>;
  queues: Record<Queue, number>;
  options: { country: Option[]; contract: Option[]; service: Option[] };
  can_export: boolean;
  can_import: boolean;
}

export const customerPageOf = (search: URLSearchParams) => {
  const page = Number(search.get('page'));
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

function listParams(search: URLSearchParams) {
  const params = new URLSearchParams({ scope: search.get('scope') ?? 'mine' });
  for (const key of ['search', 'queue', 'country', 'stage', 'contract', 'service', 'order']) {
    const value = search.get(key)?.trim();
    if (value) params.set(key, value);
  }
  return params;
}

const PATH = `${EXECUTIVE_API}/customers`;

export function customersQuery(search: URLSearchParams) {
  const params = listParams(search);
  params.set('page', String(customerPageOf(search)));
  const query = params.toString();
  return queryOptions({
    queryKey: [...EXECUTIVE_KEY, 'customers', query],
    queryFn: ({ signal }) => api<CustomerList>(`${PATH}/?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function assignedCustomersQuery(search: URLSearchParams) {
  const params = new URLSearchParams({ page: String(customerPageOf(search)) });
  const service = search.get('service');
  if (service) params.set('service', service);
  return workQuery(params);
}

export const hasExpandedCustomers = (capability?: boolean) =>
  capability === true || ON_SERVER.executiveCustomers;

export function customerListQueries(search: URLSearchParams, capability?: boolean) {
  return hasExpandedCustomers(capability)
    ? [customersQuery(search)]
    : [overviewQuery, assignedCustomersQuery(search)];
}

export const customersExportHref = (search: URLSearchParams) =>
  `${API_BASE}${PATH}/export/?${listParams(search).toString()}`;
