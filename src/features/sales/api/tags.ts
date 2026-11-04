import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import type { TagTone } from '@/components/ui/Tags';
import { customerKey, type CustomerData } from './customer';

/**
 * Customer tags (S49): one team list kept by the sales manager. Sellers put tags on a customer
 * (on the person, so they stay across leads) and filter their leads by them. Rows and the customer
 * card send tag ids; this list names them.
 */
export interface CustomerTag {
  id: number;
  name: string;
  tone: TagTone;
  /** Archived tags stay on customers but can't be added. */
  active: boolean;
}

/** Django's `MAX_TAGS_PER_CUSTOMER` (api/sales/v1/common.py). */
export const MAX_TAGS_PER_CUSTOMER = 5;

export const TAG_TONES = [
  'blue',
  'green',
  'amber',
  'red',
  'purple',
  'gray',
] as const satisfies readonly TagTone[];

const TAGS_KEY = [...SALES_KEY, 'tags'] as const;

/** The team's list. It rarely changes, so a page reads it from cache. */
export const tagsQuery = queryOptions({
  queryKey: TAGS_KEY,
  queryFn: ({ signal }) => api<CustomerTag[]>(`${SALES_API}/tags/`, { signal }),
  staleTime: 10 * 60_000,
});

/**
 * Django's `tag_key`: what two spellings of one word share (ی/ک, half-space, spaces, case), so a
 * search for «وي آي پي» finds «وی‌آی‌پی».
 */
export const tagKey = (name: string) =>
  name
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/[\u200d\u0640\u200e\u200f]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/** Tags by id, in the list's order, for the ids a row or card carries (unknown ids are dropped). */
export function tagsOf(ids: readonly number[], list: readonly CustomerTag[] | undefined) {
  if (!list) return [];
  const wanted = new Set(ids);
  return list.filter((tag) => wanted.has(tag.id));
}

/** Replaces a customer's tags, shown at once on the card (undone if Django says no). */
export function useCustomerTags(customer: number) {
  const client = useQueryClient();
  const key = customerKey(customer);
  return useMutation({
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
      if (context?.before) client.setQueryData(key, context.before);
    },
    onSuccess: (data) => {
      client.setQueryData<CustomerData>(key, (current) =>
        current ? { ...current, tags: data.tags } : current,
      );
      return client.invalidateQueries({ queryKey: [...SALES_KEY, 'leads'] });
    },
  });
}

// The manager's list
export interface ManagerTag extends CustomerTag {
  order: number;
  /** Customers carrying it. */
  customers: number;
}

export interface TagInput {
  name?: string;
  tone?: TagTone;
  active?: boolean;
  order?: number;
}

export const managerTagsQuery = queryOptions({
  queryKey: [...SALES_KEY, 'manager', 'tags'],
  queryFn: ({ signal }) => api<ManagerTag[]>(`${SALES_API}/manager/tags/`, { signal }),
});

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
