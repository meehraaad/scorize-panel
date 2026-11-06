import { useMutation } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { SALES_API } from '@/lib/sales/api';
import { TAGS_KEY, managerTagsQuery, useTagChange, type CustomerTag } from './tags';

// Only the tag picker imports this file (not `../api`), so it loads with the picker, not on the
// first page: the sales API module is part of the first-load bundle.

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
