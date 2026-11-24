import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_KEY } from '@/lib/sales/api';
import { customerKey, customerApi, type ContactLog } from './customer';

/**
 * The mutations of `./customer`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
export function useLogContact(customer: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (log: ContactLog) =>
      api(`${customerApi(customer)}/contacts/`, { method: 'POST', body: log }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export interface ContactNote {
  notes: string;
  version: string;
}

const contactNotePath = (customer: number, contact: number) =>
  `${customerApi(customer)}/contacts/${contact}/`;

export function readContactNote(customer: number, contact: number) {
  return api<ContactNote>(contactNotePath(customer, contact));
}

export function useEditContactNote(customer: number, contact: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (note: ContactNote) =>
      api<ContactNote>(contactNotePath(customer, contact), { method: 'PATCH', body: note }),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}

/** A caller's other number kept as the customer's second phone; 409 `taken`: another account's. */
export function useSetSecondPhone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ customer, phone }: { customer: number; phone: string }) =>
      api<{ phone: string }>(`${customerApi(customer)}/second-phone/`, {
        method: 'PUT',
        body: { phone },
      }),
    onSuccess: (_answer, { customer }) =>
      client.invalidateQueries({ queryKey: customerKey(customer) }),
  });
}
