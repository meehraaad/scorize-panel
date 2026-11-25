import { queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';

/**
 * Management > access (superusers; and HR within limits, key `manage_staff_access`, in the HR
 * panel): every key in the system, groups of keys, and who holds
 * what. A key is a Django permission (`app_label.codename`), a group an auth group: the same things
 * the API, the old site and Django admin check. Django: `api/access/v1/`
 * (user_profile/access_catalog.py names the keys).
 */
export const ACCESS_API = '/access/v1';
/** The HR key: give staff keys and groups, not superusers', not one's own, not protected ones. */
export const STAFF_ACCESS_PERMISSION = 'manage_staff_access';
/** Where the pages live: the management panel (founders), and HR's access section. */
export const ACCESS_PATH = '/founders/access';
export const HR_ACCESS_PATH = '/hr/access';
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
  /** Only superusers give or take it (the access key, Django admin's own…). */
  protected?: boolean;
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
  /** Kept by the system or holding a protected key: only superusers change who is in it. */
  protected?: boolean;
}

/**
 * One of the 14 sections a person's access is made of (Django `user_profile/access_sections.py`):
 * a named bundle of keys, switched on or off for a person. The writing section goes by kind of
 * document (`options`).
 */
export interface AccessSection {
  id: string;
  label: string;
  about: string;
  /** Its heading on the person's page (`SectionList.areas`). */
  area: string;
  keys: string[];
  options: { id: string; label: string }[];
  /** Only superusers switch it (the access page, the assistant, admin's content). */
  protected: boolean;
}

export interface SectionList {
  areas: KeyArea[];
  sections: AccessSection[];
  /** What each team has without any section. */
  teams: { id: number; label: string; base: string; keys: string[] }[];
}

/** The writing section: on through its kinds of document. */
export const WRITE_SECTION = 'write';

/** One person's access. `is_superuser` is only shown: it is changed in Django admin. */
export interface AccessPerson {
  id: number;
  name: string;
  email: string;
  /** The staff team's name; null for someone without an active staff record. */
  team: string | null;
  team_id?: number | null;
  /** What their team gives them without any section. */
  base?: string;
  /** The sections switched on (`write` when any kind of writing is). */
  sections?: string[];
  /** The kinds of writing of the writing section. */
  writing?: string[];
  is_superuser: boolean;
  groups: number[];
  /** Held directly; each group adds its own. */
  keys: string[];
  /** The person asking may change their access (HR: not a superuser, not themselves). */
  editable?: boolean;
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
  'superuser_on',
  'superuser_off',
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

export const sectionsQuery = queryOptions({
  queryKey: [...ACCESS_KEY, 'sections'],
  queryFn: ({ signal }) => api<SectionList>(`${ACCESS_API}/sections/`, { signal }),
  staleTime: 'static',
});

export interface PeopleFilter {
  search?: string;
  key?: string;
  group?: number;
  section?: string;
  team?: number;
  page?: number;
}

function peopleParams({ search, key, group, section, team, page }: PeopleFilter) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (key) params.set('key', key);
  if (group !== undefined) params.set('group', String(group));
  if (section) params.set('section', section);
  if (team !== undefined) params.set('team', String(team));
  if (page && page > 1) params.set('page', String(page));
  return params.toString();
}

/** `?key=` / `?group=` / `?section=` / `?team=` / `?page=` of the address. */
export function peopleFilterOf(params: URLSearchParams): PeopleFilter {
  const group = Number(params.get('group'));
  const page = Number(params.get('page'));
  const team = params.get('team');
  return {
    ...(params.get('key') ? { key: params.get('key') ?? '' } : {}),
    ...(group > 0 ? { group } : {}),
    ...(params.get('section') ? { section: params.get('section') ?? '' } : {}),
    ...(team !== null && /^\d+$/.test(team) ? { team: Number(team) } : {}),
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

export type GroupInput = Pick<AccessGroup, 'name' | 'keys'>;

/** Every key someone holds: their own and their groups' (superusers: every key). */
export function heldKeys(person: AccessPerson, groups: readonly AccessGroup[]) {
  const held = new Map<string, string[]>(person.keys.map((key) => [key, []]));
  for (const group of groups) {
    if (!person.groups.includes(group.id)) continue;
    for (const key of group.keys) held.set(key, [...(held.get(key) ?? []), group.name]);
  }
  return held;
}
