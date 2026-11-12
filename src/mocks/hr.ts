import { http, HttpResponse } from 'msw';
import type {
  Contract,
  ContractKind,
  HrCalendar,
  HrOptions,
  HrToday,
  Move,
  MoveKind,
  MoveStep,
  NewStaff,
  OpenMove,
  StaffFile,
  StaffRow,
  Team,
} from '@/features/hr/api';
import { forbidden, notFound, storage } from './session';

/**
 * Fake HR panel (lang `api/hr/v1/`, `human_resource/`): three staff members — Ali on a permanent
 * contract, Maryam on a trial ending soon with a birthday this week, Bahar joining today with her
 * checklist open. Amir (6, a superuser) holds the key; nobody else does. Same shapes as Django.
 */

const API = '/api/hr/v1';
const HR_USER = 6;
const DAY = 86_400_000;

const dayValue = (date: Date) =>
  `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const inDays = (days: number) => dayValue(new Date(Date.now() + days * DAY));

const ENTRY_STEPS: [string, string][] = [
  ['ساخت حساب پنل و نقش‌ها', 'hr'],
  ['ایمیل شرکتی', 'hr'],
  ['داخلی تلفن دفتر و داخلی موبایل', 'hr'],
  ['ثبت روی دستگاه حضور و غیاب و وصل شماره', 'hr'],
  ['قرارداد امضاشده در مدارک', 'hr'],
  ['مدارک: کارت ملی، مدرک تحصیلی، گواهی سوء پیشینه', 'employee'],
  ['معرفی به بیمه', 'hr'],
  ['معرفی به تیم و آموزش هفته‌ی اول', 'manager'],
];
const EXIT_STEPS = [
  'انتقال مشتری‌ها، لیدها و پرونده‌ها',
  'کارهای باز به جانشین',
  'تحویل لپ‌تاپ، کارت و وسایل',
  'بستن ایمیل شرکتی و داخلی تلفن',
  'حذف از دستگاه حضور و غیاب',
  'تسویه‌ی حقوق و مانده‌ی مرخصی',
  'مصاحبه‌ی خروج',
];

const ME = { id: 10, name: 'امیر عابدی' };
let nextId = 1000;
const newId = () => ++nextId;

interface MockStaff extends Omit<StaffFile, 'move' | 'state' | 'contract'> {
  moves: (Move & { steps: MoveStep[] })[];
}

function makeMove(staff: { id: number; name: string }, kind: MoveKind, day: string, reason = '') {
  const labels =
    kind === 'entry'
      ? ENTRY_STEPS.map(([label, owner]) => ({ label, owner }))
      : EXIT_STEPS.map((label) => ({ label, owner: 'hr' }));
  const steps: MoveStep[] = labels.map(({ label, owner }) => ({
    id: newId(),
    label,
    done: false,
    task: newId(),
    due: day,
    owner: owner === 'employee' ? { id: staff.id, name: staff.name } : ME,
  }));
  return {
    id: newId(),
    kind,
    day,
    status: 'open' as const,
    reason,
    done: 0,
    total: steps.length,
    steps,
  };
}

function person(
  id: number,
  name: string,
  fields: Partial<MockStaff> & { kind: ContractKind; start: string; end: string | null },
): MockStaff {
  const { kind, start, end, ...rest } = fields;
  return {
    id,
    user: id + 600,
    name,
    face: null,
    position: { id: 2, name: 'کارشناس فروش' },
    team: 'sales',
    manager: { id: 9, name: 'رضا کامرانی' },
    personnel_code: String(100 + id),
    entry_date: start,
    leaving_date: null,
    is_active: true,
    birth_date: '1993-02-10',
    device: true,
    info: {
      full_name: name,
      fathers_name: '',
      id_number: String(4000 + id),
      national_code: '',
      birth_place: 'تهران',
      birth_date: '1993-02-10',
      marital_status: null,
      number_of_children: null,
      degree: null,
      work_experience: null,
      address: '',
      phone_number: `0912${String(1_000_000 + id)}`,
      work_email: '',
      internal_email: '',
      internal_number: null,
      office_extension: null,
      mobile_extension: null,
    },
    pay: { salary: 25_000_000, has_insurance: true, commission: '', changes: [] },
    contracts: [{ id: newId(), kind, start, end, note: '', file: null }],
    documents: [],
    devices: [10 + id],
    moves: [],
    history: [{ at: start, kind: 'joined', by: null }],
    ...rest,
  };
}

function initial(): MockStaff[] {
  const birthday = new Date(Date.now() + 2 * DAY);
  const bahar = person(3, 'بهار نیکو', {
    kind: 'trial',
    start: inDays(0),
    end: inDays(90),
    device: false,
    devices: [],
    team: 'support',
    position: null,
    manager: null,
  });
  bahar.moves = [makeMove(bahar, 'entry', inDays(0))];
  return [
    person(1, 'علی رضایی', {
      kind: 'permanent',
      start: '2022-04-01',
      end: null,
      pay: {
        salary: 32_000_000,
        has_insurance: true,
        commission: '۲٪',
        changes: [
          {
            id: 1,
            amount: 32_000_000,
            effective: '2025-03-21',
            note: 'افزایش سالانه',
            by: ME.name,
            at: '2025-03-10T09:00:00Z',
          },
        ],
      },
    }),
    person(2, 'مریم کریمی', {
      kind: 'trial',
      start: inDays(-75),
      end: inDays(15),
      birth_date: `1995-${String(birthday.getMonth() + 1).padStart(2, '0')}-${String(birthday.getDate()).padStart(2, '0')}`,
    }),
    bahar,
  ];
}

let staff = initial();

export function resetHrMocks() {
  staff = initial();
}

const allowed = () => storage.get() === HR_USER;

/** Who works here now, for the pay mocks (src/mocks/hrPay.ts). */
export const payStaff = () =>
  staff
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      name: row.name,
      face: row.face,
      position: row.position,
      personnel_code: row.personnel_code,
      salary: row.pay.salary ?? 0,
      insured: row.pay.has_insurance,
    }));
export const hrAllowed = allowed;

function counted(move: Move & { steps: MoveStep[] }) {
  move.done = move.steps.filter((step) => step.done).length;
  move.total = move.steps.length;
  return move;
}

function stateOf(row: MockStaff): StaffRow['state'] {
  if (!row.is_active) return 'inactive';
  const open = row.moves.filter((move) => move.status === 'open');
  if (open.some((move) => move.kind === 'exit')) return 'leaving';
  if (open.some((move) => move.kind === 'entry')) return 'joining';
  return row.contracts[0]?.kind === 'trial' ? 'trial' : 'active';
}

function rowOf(row: MockStaff): StaffRow {
  const open = row.moves.find((move) => move.status === 'open');
  const {
    info: _info,
    pay: _pay,
    contracts,
    documents: _d,
    devices: _v,
    moves: _m,
    history: _h,
    ...rest
  } = row;
  let move: Move | null = null;
  if (open) {
    const { steps: _steps, ...brief } = counted(open);
    move = brief;
  }
  return { ...rest, contract: contracts[0] ?? null, move, state: stateOf(row) };
}

const fileOf = (row: MockStaff): StaffFile => ({
  ...row,
  ...rowOf(row),
  moves: row.moves.map(counted),
});

function openMoves(): OpenMove[] {
  return staff
    .flatMap((row) =>
      row.moves
        .filter((move) => move.status === 'open')
        .map((move) => ({ ...counted(move), staff: { id: row.id, name: row.name } })),
    )
    .sort((a, b) => a.day.localeCompare(b.day));
}

const find = (id: unknown) => staff.find((row) => row.id === Number(id));

function today(): HrToday {
  const active = staff.filter((row) => row.is_active);
  const states = active.map(stateOf);
  const count = (name: StaffRow['state']) => states.filter((state) => state === name).length;
  const now = inDays(0);
  const month = inDays(30);
  const week = inDays(7);
  return {
    counts: {
      active: count('active'),
      trial: count('trial'),
      joining: count('joining'),
      leaving: count('leaving'),
      total: active.length,
      no_device: active.filter((row) => !row.device).length,
    },
    attendance: { present: 1, late: 1, absent: 0, pending: 1 },
    moves: openMoves(),
    ending: active.flatMap((row) => {
      const contract = row.contracts[0];
      return contract?.end && contract.end >= now && contract.end <= month
        ? [{ staff: { id: row.id, name: row.name }, kind: contract.kind, end: contract.end }]
        : [];
    }),
    birthdays: active.flatMap((row) => {
      if (!row.birth_date) return [];
      const day = `${now.slice(0, 4)}${row.birth_date.slice(4)}`;
      return day >= now && day <= week ? [{ staff: { id: row.id, name: row.name }, day }] : [];
    }),
  };
}

function calendar(from: string, to: string): HrCalendar {
  const events: HrCalendar['events'] = [];
  for (const row of staff.filter((item) => item.is_active)) {
    const contract = row.contracts[0];
    if (contract?.end && contract.end >= from && contract.end <= to)
      events.push({
        id: `c${String(contract.id)}`,
        kind: contract.kind === 'trial' ? 'trial_end' : 'contract_end',
        day: contract.end,
        staff: { id: row.id, name: row.name },
      });
    for (const move of row.moves)
      if (move.status !== 'cancelled' && move.day >= from && move.day <= to)
        events.push({
          id: `m${String(move.id)}`,
          kind: move.kind,
          day: move.day,
          staff: { id: row.id, name: row.name },
        });
    if (row.birth_date) {
      const day = `${from.slice(0, 4)}${row.birth_date.slice(4)}`;
      if (day >= from && day <= to)
        events.push({
          id: `b${String(row.id)}`,
          kind: 'birthday',
          day,
          staff: { id: row.id, name: row.name },
        });
    }
  }
  const today = inDays(0);
  const open = openMoves().flatMap((move) => move.steps.filter((step) => !step.done));
  return {
    tasks: open.length ? [{ day: today, mine: open.length, requests: 0, done: 0 }] : [],
    task_rows: open.map((step) => ({
      id: step.task ?? 0,
      kind: 'mine' as const,
      text: step.label,
      due_at: `${today}T23:59:00+03:30`,
      timed: false,
      done: false,
      customer: null,
      name: '',
    })),
    events: events.sort((a, b) => a.day.localeCompare(b.day)),
  };
}

const OPTIONS: HrOptions = {
  positions: [
    { id: 1, name: 'مدیر فروش', parent: null },
    { id: 2, name: 'کارشناس فروش', parent: 1 },
    { id: 3, name: 'پشتیبان', parent: null },
  ],
  teams: [
    'sales',
    'executive',
    'marketing',
    'management',
    'support',
    'technical',
    'writing',
    'search',
    'language',
  ],
  contracts: ['trial', 'fixed', 'permanent', 'project'],
  document_types: [
    { id: 1, name: 'کارت ملی' },
    { id: 2, name: 'مدرک تحصیلی' },
  ],
};

const invalid = (errors: Record<string, string[]>) => HttpResponse.json(errors, { status: 400 });

export const hrHandlers = [
  http.get(`${API}/today/`, () => (allowed() ? HttpResponse.json(today()) : forbidden())),
  http.get(`${API}/options/`, () => (allowed() ? HttpResponse.json(OPTIONS) : forbidden())),
  http.get(`${API}/calendar/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const params = new URL(request.url).searchParams;
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    if (!from || !to || to < from) return invalid({ to: ['The last day is before the first.'] });
    return HttpResponse.json(calendar(from, to));
  }),
  http.get(`${API}/moves/`, () =>
    allowed() ? HttpResponse.json({ results: openMoves() }) : forbidden(),
  ),
  http.get(`${API}/staff/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const all = new URL(request.url).searchParams.get('all') === '1';
    const rows = staff.filter((row) => all || row.is_active).map(rowOf);
    return HttpResponse.json({ results: rows.sort((a, b) => a.name.localeCompare(b.name)) });
  }),
  http.post(`${API}/staff/`, async ({ request }) => {
    if (!allowed()) return forbidden();
    const body = (await request.json()) as NewStaff;
    if (staff.some((row) => row.info.phone_number === body.phone_number))
      return invalid({ phone_number: ['This number already has a staff file.'] });
    const position = OPTIONS.positions.find((item) => item.id === body.position);
    const name = `${body.first_name} ${body.last_name}`;
    const row = person(newId(), name, {
      kind: body.contract,
      start: body.entry_date,
      end: body.contract_end ?? null,
      team: body.team ?? null,
      position: position ? { id: position.id, name: position.name } : null,
      manager: null,
      device: false,
      devices: [],
    });
    row.info.phone_number = body.phone_number;
    row.info.id_number = body.id_number;
    row.pay = { salary: body.salary, has_insurance: false, commission: '', changes: [] };
    row.moves = [makeMove(row, 'entry', body.entry_date)];
    staff.push(row);
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.get(`${API}/staff/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    return row ? HttpResponse.json(fileOf(row)) : notFound();
  }),
  http.patch(`${API}/staff/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row) return notFound();
    const body = (await request.json()) as Record<string, unknown>;
    const { position, team, ...info } = body;
    Object.assign(row.info, info);
    if (typeof info.full_name === 'string') row.name = info.full_name;
    if (team !== undefined) row.team = team as Team | null;
    if (position !== undefined) {
      const found = OPTIONS.positions.find((item) => item.id === position);
      row.position = found ? { id: found.id, name: found.name } : null;
    }
    return HttpResponse.json(fileOf(row));
  }),
  http.post(`${API}/staff/:id/contracts/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row) return notFound();
    const body = (await request.json()) as Omit<Contract, 'id' | 'file'>;
    if (body.end && body.end < body.start)
      return invalid({ end: ['The last day is before the first.'] });
    row.contracts.unshift({
      id: newId(),
      file: null,
      ...body,
      note: body.note || '',
      end: body.end ?? null,
    });
    row.history.unshift({
      at: body.start,
      kind: 'contract',
      contract: body.kind,
      end: body.end,
      by: ME.name,
    });
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.post(`${API}/staff/:id/salary/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row) return notFound();
    const body = (await request.json()) as { amount: number; effective: string; note?: string };
    row.pay.changes.unshift({
      id: newId(),
      amount: body.amount,
      effective: body.effective,
      note: body.note ?? '',
      by: ME.name,
      at: new Date().toISOString(),
    });
    if (body.effective <= inDays(0)) row.pay.salary = body.amount;
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.post(`${API}/staff/:id/documents/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row) return notFound();
    row.documents.push({ id: newId(), type: { id: 1, name: 'کارت ملی' }, url: '/media/hr/id.pdf' });
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.post(`${API}/staff/:id/exit/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row?.is_active) return notFound();
    if (row.moves.some((move) => move.kind === 'exit' && move.status === 'open'))
      return HttpResponse.json({ detail: 'Their leaving has already started.' }, { status: 409 });
    const body = (await request.json()) as { day: string; reason?: string };
    row.moves.unshift(makeMove(row, 'exit', body.day, body.reason ?? ''));
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.post(`${API}/moves/:id/:action/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const owner = staff.find((row) => row.moves.some((move) => move.id === Number(params.id)));
    const move = owner?.moves.find((item) => item.id === Number(params.id));
    if (!owner || move?.status !== 'open') return notFound();
    if (params.action === 'cancel') move.status = 'cancelled';
    else if (params.action === 'finish' && move.kind === 'exit') {
      if (move.day > inDays(0))
        return HttpResponse.json({ detail: 'The last day has not come yet.' }, { status: 409 });
      move.status = 'done';
      owner.is_active = false;
      owner.leaving_date = move.day;
    } else return invalid({ detail: ['Unknown action.'] });
    return HttpResponse.json({ results: openMoves() });
  }),
  http.patch(`${API}/steps/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const { done } = (await request.json()) as { done: boolean };
    for (const row of staff)
      for (const move of row.moves) {
        const step = move.steps.find((item) => item.id === Number(params.id));
        if (!step) continue;
        if (move.status !== 'open')
          return HttpResponse.json({ detail: 'This checklist is closed.' }, { status: 409 });
        step.done = done;
        if (move.kind === 'entry' && move.steps.every((item) => item.done)) move.status = 'done';
        return HttpResponse.json(step);
      }
    return notFound();
  }),
];
