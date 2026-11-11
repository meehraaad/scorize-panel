import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';

/**
 * Management > access (superusers only): every key in the system, groups of keys, and who holds
 * what. A key is a Django permission (`app_label.codename`), a group an auth group: the same things
 * the API, the old site and Django admin check. Django: `api/access/v1/`
 * (user_profile/access_catalog.py names the keys).
 */
const ACCESS_API = '/access/v1';
/** Where the pages live: the sales panel's management area. */
export const ACCESS_PATH = '/sales/manager/access';
export const ACCESS_KEY = ['access'] as const;

export interface KeyArea {
  id: string;
  /** From Django ("فروش"). */
  label: string;
}

export interface AccessKey {
  /** `app_label.codename` */
  id: string;
  area: string;
  label: string;
  /** What it opens ('' for a key the catalog doesn't describe). */
  about: string;
  /** Django's own name. */
  name: string;
  /** Active people holding it, directly or by group (superusers apart). */
  holders: number;
  /** Groups that give it. */
  groups: number[];
}

export interface KeyList {
  areas: KeyArea[];
  keys: AccessKey[];
  superusers: number;
}

export interface AccessGroup {
  id: number;
  name: string;
  keys: string[];
  members: number;
  /** Kept by the system (Founders): only its members change. */
  system: boolean;
}

export interface AccessPerson {
  id: number;
  name: string;
  email: string;
  /** The staff team's name; null for someone without an active staff record. */
  team: string | null;
  is_superuser: boolean;
  groups: number[];
  /** Held directly; each group adds its own. */
  keys: string[];
}

export const CHANGE_ACTIONS = [
  'give',
  'take',
  'join',
  'leave',
  'group_new',
  'group_add',
  'group_remove',
  'group_rename',
  'group_delete',
] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

export interface AccessChange {
  id: number;
  action: ChangeAction;
  key: string;
  user: { id: number; name: string } | null;
  group: { id: number | null; name: string } | null;
  by: { id: number; name: string } | null;
  at: string;
}

export const keysQuery = (admin = false) =>
  queryOptions({
    queryKey: [...ACCESS_KEY, 'keys', admin],
    queryFn: ({ signal }) =>
      api<KeyList>(`${ACCESS_API}/keys/${admin ? '?admin=1' : ''}`, { signal }),
  });

export const groupsQuery = queryOptions({
  queryKey: [...ACCESS_KEY, 'groups'],
  queryFn: ({ signal }) => api<AccessGroup[]>(`${ACCESS_API}/groups/`, { signal }),
});

export interface PeopleFilter {
  search?: string;
  key?: string;
  group?: number;
  page?: number;
}

function peopleParams({ search, key, group, page }: PeopleFilter) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (key) params.set('key', key);
  if (group !== undefined) params.set('group', String(group));
  if (page && page > 1) params.set('page', String(page));
  return params.toString();
}

/** `?key=` / `?group=` / `?page=` of the address (the keys and groups pages link here). */
export function peopleFilterOf(params: URLSearchParams): PeopleFilter {
  const group = Number(params.get('group'));
  const page = Number(params.get('page'));
  return {
    ...(params.get('key') ? { key: params.get('key') ?? '' } : {}),
    ...(group > 0 ? { group } : {}),
    ...(page > 1 ? { page } : {}),
  };
}

export const peopleQuery = (filter: PeopleFilter = {}) =>
  queryOptions({
    queryKey: [...ACCESS_KEY, 'people', peopleParams(filter)],
    queryFn: ({ signal }) => {
      const params = peopleParams(filter);
      return api<Page<AccessPerson>>(`${ACCESS_API}/people/${params ? `?${params}` : ''}`, {
        signal,
      });
    },
  });

export const historyQuery = (page = 1) =>
  queryOptions({
    queryKey: [...ACCESS_KEY, 'history', page],
    queryFn: ({ signal }) =>
      api<Page<AccessChange>>(`${ACCESS_API}/history/${page > 1 ? `?page=${String(page)}` : ''}`, {
        signal,
      }),
  });

/** Every change reaches every list here (counts, members, the history). */
function useAccessMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ACCESS_KEY }),
  });
}

export const useSavePerson = (id: number) =>
  useAccessMutation((change: Partial<Pick<AccessPerson, 'groups' | 'keys'>>) =>
    api<AccessPerson>(`${ACCESS_API}/people/${String(id)}/`, { method: 'PATCH', body: change }),
  );

export type GroupInput = Pick<AccessGroup, 'name' | 'keys'>;

export const useAddGroup = () =>
  useAccessMutation((group: GroupInput) =>
    api<AccessGroup>(`${ACCESS_API}/groups/`, { method: 'POST', body: group }),
  );

export const useSaveGroup = (id: number) =>
  useAccessMutation((change: Partial<GroupInput>) =>
    api<AccessGroup>(`${ACCESS_API}/groups/${String(id)}/`, { method: 'PATCH', body: change }),
  );

export const useDeleteGroup = (id: number) =>
  useAccessMutation(() => api(`${ACCESS_API}/groups/${String(id)}/`, { method: 'DELETE' }));

export const useAddMember = (group: number) =>
  useAccessMutation((user: number) =>
    api<AccessPerson>(`${ACCESS_API}/groups/${String(group)}/members/`, {
      method: 'POST',
      body: { user },
    }),
  );

export const useRemoveMember = (group: number) =>
  useAccessMutation((user: number) =>
    api(`${ACCESS_API}/groups/${String(group)}/members/${String(user)}/`, { method: 'DELETE' }),
  );

/** Every key someone holds: their own and their groups' (superusers: every key). */
export function heldKeys(person: AccessPerson, groups: readonly AccessGroup[]) {
  const held = new Map<string, string[]>(person.keys.map((key) => [key, []]));
  for (const group of groups) {
    if (!person.groups.includes(group.id)) continue;
    for (const key of group.keys) held.set(key, [...(held.get(key) ?? []), group.name]);
  }
  return held;
}
