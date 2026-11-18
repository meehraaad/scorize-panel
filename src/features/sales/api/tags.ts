import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';
import type { TagTone } from '@/components/ui/Tags';

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

export const TAGS_KEY = [...SALES_KEY, 'tags'] as const;

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
export const tagChangesKey = (customer: number) =>
  [...SALES_KEY, 'customer-tags', customer] as const;

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
