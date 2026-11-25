import { http, HttpResponse } from 'msw';
import type {
  AccessChange,
  AccessGroup,
  AccessKey,
  AccessPerson,
  KeyArea,
  SectionList,
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

// The 14 sections and the teams' bases (Django `user_profile/access_sections.py`), keys shortened.
const section = (
  id: string,
  label: string,
  area: string,
  keys: string[],
  extra: Partial<SectionList['sections'][number]> = {},
) => ({
  id,
  label,
  about: `${label}: توضیح کوتاه.`,
  area,
  keys,
  options: [],
  protected: false,
  ...extra,
});
const WRITING_KINDS = [
  { id: 'sop', label: 'انگیزه‌نامه' },
  { id: 'cv', label: 'رزومه' },
  { id: 'recome', label: 'توصیه‌نامه' },
  { id: 'ps', label: 'اظهارنامه شخصی' },
  { id: 'ds', label: 'اظهارنامه تنوع' },
  { id: 'pl', label: 'لیست اساتید' },
];
export const SECTIONS: SectionList = {
  areas: [
    { id: 'work', label: 'کار' },
    { id: 'manage', label: 'مدیریت تیم‌ها' },
    { id: 'money', label: 'پول و همکاران' },
    { id: 'system', label: 'سیستم' },
  ],
  sections: [
    section('cases', 'همه‌ی پرونده‌ها', 'work', ['apply.can_manage_applicant']),
    section(
      'write',
      'نوشتن',
      'work',
      WRITING_KINDS.map((kind) => `user_profile.can_write_${kind.id}`),
      { options: WRITING_KINDS },
    ),
    section('executive', 'مدیریت اجرا', 'manage', ['apply.can_assign_supervisor']),
    section('writing', 'مدیریت نگارش', 'manage', ['user_profile.can_manage_sop_resume_writer']),
    section('sales', 'مدیریت فروش', 'manage', ['apply.can_assign_to_seller']),
    section('marketing', 'مدیریت مارکتینگ', 'manage', ['apply.can_manage_marketing']),
    section('finance', 'مالی', 'money', ['finance.can_manage_all_income']),
    section('hr', 'منابع انسانی', 'money', ['apply.can_manage_support_staff']),
    section('pay', 'حقوق و پاداش', 'money', ['human_resource.manage_pay']),
    section('access', 'دسترسی‌ها', 'system', ['user_profile.manage_staff_access'], {
      protected: true,
    }),
    section('messages', 'پیام‌ها', 'system', ['user_profile.manage_system_messages']),
    section('mail', 'ایمیل‌ها', 'system', ['mail_server.manage_mailboxes']),
    section('ai', 'هوش مصنوعی', 'system', ['ai.use_founders_assistant'], { protected: true }),
    section('site', 'محتوای سایت', 'system', ['blog.can_manage_redirect'], { protected: true }),
  ],
  teams: [
    { id: 0, label: 'تیم فروش', base: 'پنل فروش، مشتری‌های خودش و دیدن رزروهای مشاوره', keys: [] },
    { id: 1, label: 'تیم اجرا', base: 'پنل اجرا و پرونده‌هایی که مسئولشان است', keys: [] },
    { id: 3, label: 'تیم مدیریت', base: 'پنل خودش؛ هیئت مدیره همه‌ی بخش‌ها را دارد', keys: [] },
    { id: 10, label: 'تیم اداری و مالی', base: 'پنل خودش (امروز، کارها، من)', keys: [] },
  ],
};
const baseOf = (team: number | null) =>
  SECTIONS.teams.find((row) => row.id === team)?.base ?? 'پنل خودش (امروز، کارها، من)';

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
  team_id: null,
  base: baseOf(rest.team_id ?? null),
  sections: [],
  writing: [],
  is_superuser: false,
  groups: [],
  keys: [],
  ...rest,
});

const people = (): AccessPerson[] => [
  person(SUPERUSER, AMIR.name, 'تیم مدیریت', { is_superuser: true, team_id: 3 }),
  person(2, 'مریم کاظمی', 'تیم اجرا', {
    team_id: 1,
    keys: ['apply.can_assign_supervisor'],
    sections: ['executive', 'write'],
    writing: ['cv'],
  }),
  person(3, 'نیما رستمی', 'تیم فروش', { team_id: 0 }),
  person(4, 'رضا کامرانی', 'تیم فروش', {
    team_id: 0,
    keys: ['apply.can_assign_to_seller'],
    sections: ['sales'],
  }),
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
  row.is_superuser ||
  row.keys.length > 0 ||
  row.groups.length > 0 ||
  (row.sections ?? []).length > 0;
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
    const sectionId = params.get('section');
    const team = params.get('team');
    let rows = search
      ? staff.filter((row) => row.name.includes(search) || row.email.includes(search))
      : keyId || group || sectionId || team
        ? staff
        : staff.filter(holdsSomething);
    if (keyId) rows = rows.filter((row) => holds(row, keyId));
    if (group) rows = rows.filter((row) => row.groups.includes(group));
    if (sectionId)
      rows = rows.filter((row) => row.is_superuser || (row.sections ?? []).includes(sectionId));
    if (team) rows = rows.filter((row) => row.team_id === Number(team));
    return HttpResponse.json(paged(rows, Number(params.get('page')) || 1));
  }),

  // One person (the staff file's access tab): Django finds any active account, so an account the
  // sample list hasn't got yet (an HR staff file's) is added with no access.
  http.get(`${API}/people/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const id = Number(params.id);
    let row = staff.find((item) => item.id === id);
    if (!row) {
      row = person(id, `کاربر ${String(id)}`, null);
      staff.push(row);
    }
    return HttpResponse.json(row);
  }),

  http.patch(`${API}/people/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = staff.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    const body = (await request.json()) as Partial<
      Pick<AccessPerson, 'groups' | 'keys' | 'is_superuser'>
    >;
    // Django: superusers are only changed in Django admin
    if (body.is_superuser !== undefined && body.is_superuser !== row.is_superuser)
      return forbidden();
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

  http.get(`${API}/sections/`, () => (allowed() ? HttpResponse.json(SECTIONS) : forbidden())),

  // Django: the whole list; `write` only with its kinds; never a superuser's (they have everything).
  http.put(`${API}/people/:id/sections/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = staff.find((item) => item.id === Number(params.id));
    if (!row) return notFound();
    if (row.is_superuser) return forbidden();
    const body = (await request.json()) as { sections: string[]; writing?: string[] };
    const writing = body.writing ?? [];
    if (body.sections.includes('write') !== writing.length > 0)
      return HttpResponse.json(
        { writing: ['Choose the kinds of writing, or switch writing off.'] },
        { status: 400 },
      );
    for (const id of body.sections)
      if (!(row.sections ?? []).includes(id))
        log({ action: 'join', key: '', user: short(row), group: { id: null, name: `بخش: ${id}` } });
    for (const id of row.sections ?? [])
      if (!body.sections.includes(id))
        log({
          action: 'leave',
          key: '',
          user: short(row),
          group: { id: null, name: `بخش: ${id}` },
        });
    row.sections = SECTIONS.sections
      .map((one) => one.id)
      .filter((id) => body.sections.includes(id));
    row.writing = WRITING_KINDS.map((kind) => kind.id).filter((id) => writing.includes(id));
    return HttpResponse.json(row);
  }),

  http.get(`${API}/history/`, ({ request }) => {
    if (!allowed()) return forbidden();
    return HttpResponse.json(
      paged(history, Number(new URL(request.url).searchParams.get('page')) || 1),
    );
  }),
];
