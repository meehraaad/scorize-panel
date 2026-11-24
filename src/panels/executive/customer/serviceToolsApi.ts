import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { EXECUTIVE_API } from '@/features/executive/api';
import { SUPERVISOR_KEY } from '@/features/supervisor/api/common';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { workspaceKey } from './api';

type ServiceAddress = { customer: number; service: number };
interface Program {
  id: number;
  name: string;
  university: string;
  country: string;
  degree: string | null;
}
export interface MailMessage {
  id: string;
  subject: string;
  contact: string;
  name: string | null;
  body: string;
  at: string | null;
  incoming: boolean;
  unread: boolean;
}
export type MailFolder = 'all' | 'inbox' | 'sent' | 'unread';

const servicePath = ({ customer, service }: ServiceAddress) =>
  `${EXECUTIVE_API}/customers/${String(customer)}/services/${String(service)}`;
const toolKey = ({ customer, service }: ServiceAddress) =>
  [...workspaceKey(customer), 'service', service] as const;

export const searchWorkspaceQuery = (address: ServiceAddress, q = '', page = 1) =>
  queryOptions({
    queryKey: [...toolKey(address), 'search', q, page],
    queryFn: ({ signal }) => {
      const filter = new URLSearchParams({ q, page: String(page) });
      return api<{
        shortlist: (Program & { deadline: string | null })[];
        catalog: Page<Program>;
        can_edit: boolean;
        reviewer: string | null;
      }>(`${servicePath(address)}/search/?${filter.toString()}`, { signal });
    },
    placeholderData: keepPreviousData,
  });

export function useChangeSearchWorkspace(address: ServiceAddress) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (program: number | null) =>
      program === null
        ? api(`${servicePath(address)}/search/review/`, { method: 'POST' })
        : api(`${servicePath(address)}/search/`, { method: 'POST', body: { program } }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: workspaceKey(address.customer) });
      void cache.invalidateQueries({ queryKey: SUPERVISOR_KEY });
    },
  });
}

export const mailWorkspaceQuery = (address: ServiceAddress, folder: MailFolder = 'all', page = 1) =>
  queryOptions({
    queryKey: [...toolKey(address), 'mail', folder, page],
    queryFn: ({ signal }) =>
      api<Page<MailMessage> & { can_send: boolean }>(
        `${servicePath(address)}/mail/?folder=${folder}&page=${String(page)}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });

export function useSendCustomerMail(address: ServiceAddress) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (draft: { recipient: string; subject: string; body: string; reply_to?: string }) =>
      api(`${servicePath(address)}/mail/`, { method: 'POST', body: draft }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: toolKey(address) });
    },
  });
}
