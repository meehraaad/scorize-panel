import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
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

/** `CustomerTag.name`'s `max_length`. */
export const MAX_TAG_NAME = 32;

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

/**
 * One customer's tag changes run one after another (a React Query mutation scope), so a quick
 * second tap can't land before the first and leave the older list on the server. Django also
 * locks the customer's row while it changes their tags.
 */
const tagChangesKey = (customer: number) => [...SALES_KEY, 'customer-tags', customer] as const;

function useTagChange(customer: number) {
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

export interface TagAdded {
  /** The team's tag with this name (however it was typed), or the new one. */
  tag: CustomerTag;
  /** The customer's tags now. */
  tags: number[];
}

/** Why Django didn't put a tag on by name: `archived` / `too_many` are 409s, `full` a 400. */
export type TagAddRefusal = 'archived' | 'too_many' | 'full' | 'throttled';

export function tagAddRefusal(error: unknown): TagAddRefusal | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 429) return 'throttled';
  if (error.status === 400) return 'full';
  const code = (error.body as { code?: unknown } | null)?.code;
  return error.status === 409 && (code === 'archived' || code === 'too_many') ? code : null;
}

/**
 * Puts a tag on by name: the team's tag with the same key, or a new one Django adds to the list
 * (the unique key keeps two sellers typing one new word at once to one tag). Searching never calls
 * this: the picker filters the list it already has, so only a tap on "create" sends a request.
 */
export function useAddTagByName(customer: number) {
  const { client, mutationKey, scope, settle } = useTagChange(customer);
  return useMutation({
    mutationKey,
    scope,
    mutationFn: (name: string) =>
      api<TagAdded>(`${SALES_API}/customers/${String(customer)}/tags/`, {
        method: 'POST',
        body: { name },
      }),
    onSuccess: (data) => {
      // The list may be minutes old, and another seller may have just made this tag.
      client.setQueryData<CustomerTag[]>(TAGS_KEY, (list) =>
        list && !list.some((tag) => tag.id === data.tag.id) ? [...list, data.tag] : list,
      );
      return Promise.all([
        settle(data.tags),
        client.invalidateQueries({ queryKey: managerTagsQuery.queryKey }),
      ]);
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
