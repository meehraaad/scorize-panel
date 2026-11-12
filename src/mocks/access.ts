import { http, HttpResponse } from 'msw';
import type {
  AccessChange,
  AccessGroup,
  AccessKey,
  AccessPerson,
  KeyArea,
} from '@/features/access/api';
import { forbidden, notFound, storage } from './session';

/**
 * Fake management > access (scorize `api/access/v1/`): a few keys by area, two groups (Founders is
 * kept by the system), the people holding something, and the history. Only Amir (6, superuser).
 */

const API = '/api/access/v1';
const SUPERUSER = 6;
const PAGE_SIZE = 20;
const AMIR = { id: SUPERUSER, name: 'امیر عابدی' };

const AREAS: KeyArea[] = [
  { id: 'sales', label: 'فروش' },
  { id: 'cases', label: 'پرونده‌ها و پشتیبانی' },
  { id: 'messages', label: 'پیام‌ها' },
  { id: 'ai', label: 'هوش مصنوعی' },
  { id: 'other', label: 'کلیدهای دیگر' },
];
const ADMIN_AREA: KeyArea = { id: 'admin', label: 'ادمین جنگو' };

const key = (id: string, area: string, label: string, about: string) => ({
  id,
  area,
  label,
  about,
  name: id,
});
const KEYS = [
  key(
    'apply.can_assign_to_seller',
    'sales',
    'مدیر فروش',
    'بخش مدیریت فروش: تقسیم لیدها، تأیید و قراردادساز.',
  ),
  key(
    'apply.can_manage_applicant',
    'cases',
    'مدیریت پرونده‌ها',
    'پنل سرپرست: همه‌ی پرونده‌های اپلای.',
  ),
  key('apply.can_assign_supervisor', 'cases', 'تعیین سرپرست', 'سپردن پرونده‌ی تازه به سرپرست.'),
  key(
    'user_profile.manage_system_messages',
    'messages',
    'پیام‌های خودکار',
    'متن زنگوله و تلگرام، روشن و خاموش.',
  ),
  key(
    'user_profile.manage_ready_messages',
    'messages',
    'پیام‌های آماده',
    'پیام‌های آماده‌ی فروشنده‌ها و تیکت.',
  ),
  key('ai.use_founders_assistant', 'ai', 'دستیار بنیان‌گذاران', 'دستیار هوش مصنوعی بنیان‌گذاران.'),
];
const ADMIN_KEYS = [key('apply.change_contract', 'admin', 'Can change contract', '')];

const groups = (): AccessGroup[] => [
  { id: 1, name: 'Founders', keys: ['ai.use_founders_assistant'], members: 1, system: true },
  {
    id: 2,
    name: 'ناظر پیام',
    keys: ['user_profile.manage_system_messages', 'user_profile.manage_ready_messages'],
    members: 0,
    system: false,
  },
];

const person = (
  id: number,
  name: string,
  team: string | null,
  rest: Partial<AccessPerson> = {},
): AccessPerson => ({
  id,
  name,
  email: `user${String(id)}@scorize.local`,
  team,
  is_superuser: false,
  groups: [],
  keys: [],
  ...rest,
});

const people = (): AccessPerson[] => [
  person(SUPERUSER, AMIR.name, 'تیم مدیریت', { is_superuser: true }),
  person(2, 'مریم کاظمی', 'تیم اجرایی', { keys: ['apply.can_assign_supervisor'] }),
  person(3, 'نیما رستمی', 'تیم فروش'),
  person(4, 'رضا کامرانی', 'تیم فروش', { keys: ['apply.can_assign_to_seller'] }),
  person(5, 'بهار نوری', null, { groups: [1] }),
];

let groupList = groups();
let staff = people();
let history: AccessChange[] = [];
let nextId = 100;

export function resetAccessMocks() {
  groupList = groups();
  staff = people();
  history = [];
  nextId = 100;
}

const allowed = () => storage.get() === SUPERUSER;
const holdsSomething = (row: AccessPerson) =>
  row.is_superuser || row.keys.length > 0 || row.groups.length > 0;
const holds = (row: AccessPerson, id: string) =>
  row.is_superuser ||
  row.keys.includes(id) ||
  groupList.some((group) => row.groups.includes(group.id) && group.keys.includes(id));
const withCounts = (group: AccessGroup): AccessGroup => ({
  ...group,
  members: staff.filter((row) => row.groups.includes(group.id)).length,
});
const log = (change: Omit<AccessChange, 'id' | 'by' | 'at'>) => {
  history = [{ id: nextId++, by: AMIR, at: new Date().toISOString(), ...change }, ...history];
};
const short = (row: AccessPerson) => ({ id: row.id, name: row.name });
const paged = <T>(rows: T[], page: number) => ({
  count: rows.length,
  page_size: PAGE_SIZE,
  results: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
});

export const accessHandlers = [
  http.get(`${API}/keys/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const admin = new URL(request.url).searchParams.get('admin') === '1';
    const keys: AccessKey[] = [...KEYS, ...(admin ? ADMIN_KEYS : [])].map((row) => ({
      ...row,
      holders: staff.filter((item) => !item.is_superuser && holds(item, row.id)).length,
      groups: groupList.filter((group) => group.keys.includes(row.id)).map((group) => group.id),
    }));
    return HttpResponse.json({
      areas: admin ? [...AREAS, ADMIN_AREA] : AREAS,
      keys,
      superusers: staff.filter((row) => row.is_superuser).length,
    });
  }),

  http.get(`${API}/groups/`, () =>
    allowed() ? HttpResponse.json(groupList.map(withCounts)) : forbidden(),
  ),

  http.post(`${API}/groups/`, async ({ request }) => {
    if (!allowed()) return forbidden();
    const body = (await request.json()) as { name: string; keys?: string[] };
    if (groupList.some((group) => group.name === body.name))
      return HttpResponse.json({ name: ['گروهی با این نام هست.'] }, { status: 400 });
    const group = {
      id: nextId++,
      name: body.name,
      keys: body.keys ?? [],
      members: 0,
      system: false,
    };
    groupList = [...groupList, group];
    log({ action: 'group_new', key: '', user: null, group: { id: group.id, name: group.name } });
    return HttpResponse.json(group, { status: 201 });
  }),

  http.patch(`${API}/groups/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const group = groupList.find((item) => item.id === Number(params.id));
    if (!group) return notFound();
    if (group.system) return forbidden();
    Object.assign(group, (await request.json()) as Partial<AccessGroup>);
    return HttpResponse.json(withCounts(group));
  }),

  http.delete(`${API}/groups/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const group = groupList.find((item) => item.id === Number(params.id));
    if (!group) return notFound();
    if (group.system) return forbidden();
    groupList = groupList.filter((item) => item !== group);
    for (const row of staff) row.groups = row.groups.filter((id) => id !== group.id);
    log({ action: 'group_delete', key: '', user: null, group: { id: null, name: group.name } });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/groups/:id/members/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const group = groupList.find((item) => item.id === Number(params.id));
    const { user } = (await request.json()) as { user: number };
    const row = staff.find((item) => item.id === user);
    if (!group || !row) return notFound();
    if (!row.groups.includes(group.id)) {
      row.groups = [...row.groups, group.id];
      log({ action: 'join', key: '', user: short(row), group: { id: group.id, name: group.name } });
    }
    return HttpResponse.json(row);
  }),

  http.delete(`${API}/groups/:id/members/:user/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = staff.find((item) => item.id === Number(params.user));
    if (!row) return notFound();
    row.groups = row.groups.filter((id) => id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/people/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const params = new URL(request.url).searchParams;
    const search = params.get('search') ?? '';
    const keyId = params.get('key');
    const group = Number(params.get('group'));
    let rows = search
      ? staff.filter((row) => row.name.includes(search) || row.email.includes(search))
      : keyId || group
        ? staff
        : staff.filter(holdsSomething);
    if (keyId) rows = rows.filter((row) => holds(row, keyId));
    if (group) rows = rows.filter((row) => row.groups.includes(group));
    return HttpResponse.json(paged(rows, Number(params.get('page')) || 1));
  }),

  http.patch(`${API}/people/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = staff.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    const body = (await request.json()) as Partial<
      Pick<AccessPerson, 'groups' | 'keys' | 'is_superuser'>
    >;
    if (body.is_superuser !== undefined && body.is_superuser !== row.is_superuser) {
      // Django: never one's own
      if (row.id === storage.get()) return forbidden();
      log({
        action: body.is_superuser ? 'superuser_on' : 'superuser_off',
        key: '',
        user: short(row),
        group: null,
      });
    }
    for (const id of body.keys ?? []) {
      if (!row.keys.includes(id)) log({ action: 'give', key: id, user: short(row), group: null });
    }
    for (const id of row.keys) {
      if (body.keys && !body.keys.includes(id))
        log({ action: 'take', key: id, user: short(row), group: null });
    }
    Object.assign(row, body);
    return HttpResponse.json(row);
  }),

  http.get(`${API}/history/`, ({ request }) => {
    if (!allowed()) return forbidden();
    return HttpResponse.json(
      paged(history, Number(new URL(request.url).searchParams.get('page')) || 1),
    );
  }),
];
