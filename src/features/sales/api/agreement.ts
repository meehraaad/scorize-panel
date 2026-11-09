import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Agreement } from '@/lib/agreement/api';
import { api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';
import { customerKey } from './customer';

/** The contract agreement desk of a customer (S62): null until the seller sends or submits. */
export const agreementKey = (id: number) => [...customerKey(id), 'agreement'] as const;
const base = (id: number) => `${SALES_API}/customers/${String(id)}/agreement/`;

export const agreementQuery = (id: number) =>
  queryOptions({
    queryKey: agreementKey(id),
    queryFn: ({ signal }) => api<{ agreement: Agreement | null }>(base(id), { signal }),
    select: (data) => data.agreement,
  });

function useAgreementChange<T>(id: number, mutationFn: (variables: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => client.invalidateQueries({ queryKey: agreementKey(id) }),
  });
}

/** The session consultant agrees to a version (409 `stale` when a newer one came meanwhile). */
export const useAgree = (id: number) =>
  useAgreementChange(id, (version: number) =>
    api(`${base(id)}agree/`, { method: 'POST', body: { version } }),
  );

export const useAddRemark = (id: number) =>
  useAgreementChange(id, (body: { version: number; clause: string; text: string }) =>
    api(`${base(id)}remarks/`, { method: 'POST', body }),
  );

/** The seller answers a question or change request. */
export const useAnswerRemark = (id: number) =>
  useAgreementChange(id, ({ remark, text }: { remark: number; text: string }) =>
    api(`${base(id)}remarks/${String(remark)}/answer/`, { method: 'POST', body: { text } }),
  );
