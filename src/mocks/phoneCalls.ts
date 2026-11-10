import { http, HttpResponse } from 'msw';
import type {
  MenuKey,
  OfficeHoursInput,
  OfficeHoursState,
  PhoneMenus,
  PhoneSnapshot,
  PhoneTeamInput,
  PhoneTeams,
} from '@/lib/sales/phoneCalls';
import { forbidden, storage } from './session';

let snapshots = new Map<number, PhoneSnapshot>();

const PBX_HOURS = (open: string, close: string) =>
  (['sun', 'mon', 'tue', 'wed', 'thu'] as const).map((day) => ({ day, open, close }));
const freshHours = (): OfficeHoursState => ({
  saved: false,
  week: PBX_HOURS('10:30', '19:00'),
  direct: PBX_HOURS('11:30', '13:00'),
  closed_days: [],
  force: '',
  open_now: true,
  updated_at: null,
  updated_by: null,
});
let hours = freshHours();

const freshTeams = (): PhoneTeams => ({
  seen_at: '2026-11-10T14:00:00Z',
  people: [
    { id: 8, name: 'نیما رضایی', desk: '104', mobile: '302' },
    { id: 9, name: 'رضا کامرانی', desk: null, mobile: '305' },
  ],
  teams: [
    {
      number: '1000',
      name: 'moshavere-foroosh',
      saved: false,
      members: [8],
      outside_numbers: ['09962833918'],
      unknown: ['230'],
      dynamic: ['103'],
    },
  ],
});
let teams = freshTeams();

const freshMenus = (): PhoneMenus => ({
  seen_at: '2026-11-10T14:00:00Z',
  options: {
    teams: [
      { number: '1000', name: 'moshavere-foroosh' },
      { number: '1001', name: 'poshtibani' },
    ],
    menus: [
      { id: '1', name: 'ivr-main' },
      { id: '5', name: 'ivr-outtime' },
    ],
    messages: ['feedbacks', 'peyghamgir'],
    people: freshTeams().people,
    directs: ['223'],
  },
  menus: [
    {
      id: '1',
      name: 'ivr-main',
      saved: false,
      keys: [
        { key: '1', kind: 'team', target: '1000' },
        { key: '4', kind: 'message', target: 'feedbacks' },
        { key: '223', kind: 'direct', target: '223' },
        { key: '9', kind: 'other', target: 'custom-thing,s,1' },
      ],
    },
    { id: '5', name: 'ivr-outtime', saved: false, keys: [] },
  ],
});
let menus = freshMenus();

export function setPhoneSnapshot(owner: number, snapshot: PhoneSnapshot) {
  snapshots.set(owner, snapshot);
}

export function resetPhoneMocks() {
  snapshots = new Map();
  hours = freshHours();
  teams = freshTeams();
  menus = freshMenus();
}

/** Django's checks in OfficeHoursSerializer, with its messages. */
function hoursErrors(body: OfficeHoursInput) {
  const errors: Record<string, string[]> = {};
  if (body.week.length === 0) errors.week = ['Open the line on at least one day.'];
  for (const key of ['week', 'direct'] as const) {
    if (body[key].some((row) => row.close <= row.open))
      errors[key] = ['Closing time must be after opening time.'];
  }
  return errors;
}

const TEAM_NAME = /^[^\r\n;,|\\[\]"<>]{1,40}$/;

function teamErrors(body: PhoneTeamInput) {
  const errors: Record<string, string[]> = {};
  if (!TEAM_NAME.test(body.name)) errors.name = ['Enter a valid value.'];
  if (body.outside_numbers.some((phone) => !/^09\d{9}$/.test(phone)))
    errors.outside_numbers = ['Enter a valid value.'];
  return errors;
}

export const phoneCallHandlers = [
  // Phone menus: sales managers only; a key to a team or menu the PBX hasn't is refused like Django.
  http.get('/api/sales/v1/calls/menus/', () =>
    storage.get() === 4 ? HttpResponse.json(menus) : forbidden(),
  ),
  http.put('/api/sales/v1/calls/menus/:id/', async ({ request, params }) => {
    if (storage.get() !== 4) return forbidden();
    const { keys } = (await request.json()) as { keys: MenuKey[] };
    if (!menus.menus.some((menu) => menu.id === params.id))
      return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    const wrong = keys.find(
      (key) =>
        (key.kind === 'team' && !menus.options.teams.some((team) => team.number === key.target)) ||
        (key.kind === 'menu' &&
          (key.target === params.id || !menus.options.menus.some((m) => m.id === key.target))),
    );
    if (wrong)
      return HttpResponse.json(
        { keys: [`Key ${wrong.key} goes nowhere the PBX has.`] },
        { status: 400 },
      );
    menus = {
      ...menus,
      menus: menus.menus.map((menu) =>
        menu.id === params.id ? { ...menu, keys, saved: true } : menu,
      ),
    };
    return HttpResponse.json(menus);
  }),
  // Phone teams: sales managers only, like IsSalesManager.
  http.get('/api/sales/v1/calls/teams/', () =>
    storage.get() === 4 ? HttpResponse.json(teams) : forbidden(),
  ),
  http.post('/api/sales/v1/calls/teams/', async ({ request }) => {
    if (storage.get() !== 4) return forbidden();
    const body = (await request.json()) as PhoneTeamInput;
    const errors = teamErrors(body);
    if (Object.keys(errors).length > 0) return HttpResponse.json(errors, { status: 400 });
    const used = new Set(teams.teams.map((team) => Number(team.number)));
    let number = 1000;
    while (used.has(number)) number += 1;
    teams = {
      ...teams,
      teams: [
        ...teams.teams,
        { number: String(number), ...body, saved: true, unknown: [], dynamic: [] },
      ],
    };
    return HttpResponse.json(teams, { status: 201 });
  }),
  http.put('/api/sales/v1/calls/teams/:number/', async ({ request, params }) => {
    if (storage.get() !== 4) return forbidden();
    const body = (await request.json()) as PhoneTeamInput;
    if (!teams.teams.some((team) => team.number === params.number))
      return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
    const errors = teamErrors(body);
    if (Object.keys(errors).length > 0) return HttpResponse.json(errors, { status: 400 });
    teams = {
      ...teams,
      teams: teams.teams.map((team) =>
        team.number === params.number ? { ...team, ...body, saved: true, unknown: [] } : team,
      ),
    };
    return HttpResponse.json(teams);
  }),
  // Office hours: sales managers only (Reza, user 4), like IsSalesManager.
  http.get('/api/sales/v1/calls/hours/', () =>
    storage.get() === 4 ? HttpResponse.json(hours) : forbidden(),
  ),
  http.put('/api/sales/v1/calls/hours/', async ({ request }) => {
    if (storage.get() !== 4) return forbidden();
    const body = (await request.json()) as OfficeHoursInput;
    const errors = hoursErrors(body);
    if (Object.keys(errors).length > 0) return HttpResponse.json(errors, { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    hours = {
      ...body,
      closed_days: [...new Set(body.closed_days.filter((day) => day >= today))].sort(),
      saved: true,
      open_now: body.force === '' ? hours.open_now : body.force === 'open',
      updated_at: new Date().toISOString(),
      updated_by: 'رضا کامرانی',
    };
    return HttpResponse.json(hours);
  }),
  http.get('/api/sales/v1/calls/', () => {
    const owner = storage.get();
    if (owner !== 3 && owner !== 4) return forbidden();
    return HttpResponse.json(
      snapshots.get(owner) ?? {
        available: false,
        enabled: false,
        connected: false,
        extension: null,
        server_time: new Date().toISOString(),
        calls: [],
      },
    );
  }),
  http.get('/api/sales/v1/calls/mobile/', () => {
    const owner = storage.get();
    if (owner !== 3 && owner !== 4) return forbidden();
    return HttpResponse.json({
      available: false,
      status: 'none',
      extension: null,
      password: null,
      domain: null,
      server: null,
    });
  }),
];
