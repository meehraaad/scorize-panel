import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import { customerKey, type CustomerData } from './customer';
import { TAGS_KEY, tagChangesKey, type ManagerTag, type TagInput, managerTagsQuery } from './tags';

/**
 * The mutations of `./tags`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
export function useTagChange(customer: number) {
  const client = useQueryClient();
  const mutationKey = tagChangesKey(customer);
  /** Django's answer is the customer's tags, unless another change is still on its way. */
  const settle = (tags: number[]) => {
    if (client.isMutating({ mutationKey }) <= 1)
      client.setQueryData<CustomerData>(customerKey(customer), (current) =>
        current ? { ...current, tags } : current,
      );
    return client.invalidateQueries({ queryKey: [...SALES_KEY, 'leads'] });
  };
  return { client, mutationKey, scope: { id: mutationKey.join(':') }, settle };
}

/** Replaces a customer's tags, shown at once on the card (undone if Django says no). */
export function useCustomerTags(customer: number) {
  const { client, mutationKey, scope, settle } = useTagChange(customer);
  const key = customerKey(customer);
  return useMutation({
    mutationKey,
    scope,
    mutationFn: (tags: number[]) =>
      api<{ tags: number[] }>(`${SALES_API}/customers/${String(customer)}/tags/`, {
        method: 'PUT',
        body: { tags },
      }),
    onMutate: async (tags) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<CustomerData>(key);
      if (before) client.setQueryData<CustomerData>(key, { ...before, tags });
      return { before };
    },
    onError: (_error, _tags, context) => {
      // A later change still on its way builds on this one: ask Django instead of undoing it.
      if (client.isMutating({ mutationKey }) > 1)
        return client.invalidateQueries({ queryKey: key });
      if (context?.before) client.setQueryData(key, context.before);
    },
    onSuccess: (data) => settle(data.tags),
  });
}

/** Add (no `id`), change or delete a tag; every change refreshes both lists. */
export function useSaveTag() {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: managerTagsQuery.queryKey }),
      client.invalidateQueries({ queryKey: TAGS_KEY }),
    ]);
  return useMutation({
    mutationFn: ({ id, ...body }: TagInput & { id?: number }) =>
      id === undefined
        ? api<ManagerTag>(`${SALES_API}/manager/tags/`, { method: 'POST', body })
        : api<ManagerTag>(`${SALES_API}/manager/tags/${String(id)}/`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}

export function useDeleteTag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`${SALES_API}/manager/tags/${String(id)}/`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: managerTagsQuery.queryKey }),
        client.invalidateQueries({ queryKey: TAGS_KEY }),
      ]),
  });
}
