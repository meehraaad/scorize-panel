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
import type {
  OnboardingAnswers,
  OnboardingFileKind,
  OnboardingReview,
  OnboardingStatus,
} from '@/features/hr/onboarding/api';
import { EMPTY_ANSWERS } from '@/features/hr/onboarding/fields';
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

/** The joining step done by sending the new-hire form (OB2). */
const FORM_STEP = 'تکمیل فرم اطلاعات فردی';
const ENTRY_STEPS: [string, string][] = [
  ['ساخت حساب پنل و نقش‌ها', 'hr'],
  ['ایمیل شرکتی', 'hr'],
  ['داخلی تلفن دفتر و داخلی موبایل', 'hr'],
  ['ثبت روی دستگاه حضور و غیاب و وصل شماره', 'hr'],
  ['قرارداد امضاشده در مدارک', 'hr'],
  [FORM_STEP, 'employee'],
  ['مدارک: مدرک تحصیلی، گواهی سوء پیشینه', 'employee'],
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

interface MockStaff extends Omit<StaffFile, 'move' | 'state' | 'contract' | 'onboarding'> {
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
    // The hire's form is due a week after the first day (OB2).
    due:
      label === FORM_STEP
        ? dayValue(new Date(new Date(`${day}T00:00:00`).getTime() + 7 * DAY))
        : day,
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

// The new-hire forms (OB1–OB6), oldest first; Bahar's opened with her joining.
interface MockForm extends OnboardingReview {
  /** Its joining step (null when HR sent it on demand). */
  stepId: number | null;
}

let staff = initial();
let forms: MockForm[] = [];

const plusDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dayValue(date);
};

const OPEN_FORM: readonly OnboardingStatus[] = ['draft', 'returned', 'submitted'];
const latestForm = (staffId: number) => forms.findLast((form) => form.staff.id === staffId);
function openFormOf(staffId: number) {
  const form = latestForm(staffId);
  return form && OPEN_FORM.includes(form.status) ? form : undefined;
}
const brief = (form: MockForm) => ({
  id: form.id,
  status: form.status,
  submitted_at: form.submitted_at,
  reviewed_at: form.reviewed_at,
  note: form.note,
});
const publicForm = ({ stepId: _step, ...form }: MockForm) => form;

/** whoami `staff.onboarding`: the staff member's open form (src/mocks/handlers.ts). */
export function openFormStatus(staffId: number) {
  const status = openFormOf(staffId)?.status;
  return status === 'draft' || status === 'returned' || status === 'submitted' ? status : null;
}

/** A new form, prefilled from the file (and an earlier approved form on a rehire). */
function openForm(row: MockStaff, move: (Move & { steps: MoveStep[] }) | null) {
  // Names from the account; a file made with the phone only has none yet.
  const named = row.name !== row.info.phone_number;
  const [first = '', ...rest] = named ? row.name.split(' ') : [];
  const form: MockForm = {
    id: newId(),
    status: 'draft',
    note: '',
    due: move ? plusDays(move.day, 7) : null,
    answers: {
      ...EMPTY_ANSWERS,
      first_name: first,
      last_name: rest.join(' '),
      fathers_name: row.info.fathers_name,
      national_code: row.info.national_code,
      id_number: row.info.id_number,
      birth_date: row.info.birth_date,
      birth_place: row.info.birth_place,
      marital_status: row.info.marital_status,
      number_of_children: row.info.number_of_children,
      address: row.info.address,
      ...row.personal,
    },
    files: [],
    fixed: { phone_number: row.info.phone_number ?? '' },
    staff: { id: row.id, name: row.name },
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    stepId: move?.steps.find((step) => step.label === FORM_STEP)?.id ?? null,
  };
  forms.push(form);
  return form;
}

function setStep(form: MockForm, done: boolean) {
  for (const row of staff)
    for (const move of row.moves) {
      const step = move.steps.find((item) => item.id === form.stepId);
      if (step) step.done = done;
    }
}

/** A cancelled joining or a leaving closes the form (OB6). */
function cancelForms(staffId: number, move?: Move & { steps: MoveStep[] }) {
  for (const form of forms)
    if (
      form.staff.id === staffId &&
      OPEN_FORM.includes(form.status) &&
      (!move || move.steps.some((step) => step.id === form.stepId))
    )
      form.status = 'cancelled';
}

function initialForms() {
  forms = [];
  const bahar = staff.find((row) => row.id === 3);
  if (bahar) openForm(bahar, bahar.moves[0] ?? null);
}
initialForms();

export function resetHrMocks() {
  staff = initial();
  initialForms();
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
      team: row.team,
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
    personal: _p,
    ...rest
  } = row;
  let move: Move | null = null;
  if (open) {
    const { steps: _steps, ...brief } = counted(open);
    move = brief;
  }
  const form = openFormOf(row.id);
  return {
    ...rest,
    contract: contracts[0] ?? null,
    move,
    state: stateOf(row),
    onboarding: form ? brief(form) : null,
  };
}

const fileOf = (row: MockStaff): StaffFile => {
  const latest = latestForm(row.id);
  return {
    ...row,
    ...rowOf(row),
    moves: row.moves.map(counted),
    onboarding: latest ? brief(latest) : null,
    personal: row.personal ?? null,
  };
};

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
      forms_to_review: forms.filter(
        (form) => form.status === 'submitted' && find(form.staff.id)?.is_active,
      ).length,
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
    { id: 3, name: 'شناسنامه' },
  ],
};

const invalid = (errors: Record<string, string[]>) => HttpResponse.json(errors, { status: 400 });

/** The logged-in user's own active staff file (the hire's side of the form). */
const me = () => staff.find((row) => row.user === storage.get() && row.is_active);
const myOpenForm = () => {
  const row = me();
  return row ? openFormOf(row.id) : undefined;
};
const EDITABLE: readonly OnboardingStatus[] = ['draft', 'returned'];
/** The unique numbers another staff file already has (submit and approve check both). */
function clashes(row: MockStaff, answers: OnboardingAnswers) {
  const errors: Record<string, string[]> = {};
  const others = staff.filter((other) => other.id !== row.id);
  if (answers.national_code && others.some((o) => o.info.national_code === answers.national_code))
    errors.national_code = ['A staff file with this national code exists.'];
  if (answers.id_number && others.some((o) => o.info.id_number === answers.id_number))
    errors.id_number = ['A staff file with this ID card number exists.'];
  return errors;
}
const closed = () => HttpResponse.json({ detail: 'This form is closed.' }, { status: 409 });

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
    // Without names (HR sends only the phone), the file is named by the phone until the form is
    // approved.
    const name = `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim() || body.phone_number;
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
    row.info.full_name = name;
    row.info.id_number = body.id_number ?? '';
    row.pay = { salary: body.salary, has_insurance: false, commission: '', changes: [] };
    row.moves = [makeMove(row, 'entry', body.entry_date)];
    staff.push(row);
    openForm(row, row.moves[0] ?? null);
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
  http.post(`${API}/staff/:id/return/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row) return notFound();
    if (row.is_active)
      return HttpResponse.json({ detail: 'They are still working here.' }, { status: 409 });
    const body = (await request.json()) as { day: string; reason?: string };
    if (!body.reason) return invalid({ reason: ['This field is required.'] });
    row.is_active = true;
    row.leaving_date = null;
    row.moves.unshift(makeMove(row, 'entry', body.day, body.reason));
    openForm(row, row.moves[0] ?? null);
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.post(`${API}/moves/:id/:action/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const owner = staff.find((row) => row.moves.some((move) => move.id === Number(params.id)));
    const move = owner?.moves.find((item) => item.id === Number(params.id));
    if (!owner || move?.status !== 'open') return notFound();
    if (params.action === 'cancel') {
      move.status = 'cancelled';
      if (move.kind === 'entry') cancelForms(owner.id, move);
    } else if (params.action === 'finish' && move.kind === 'exit') {
      if (move.day > inDays(0))
        return HttpResponse.json({ detail: 'The last day has not come yet.' }, { status: 409 });
      move.status = 'done';
      owner.is_active = false;
      owner.leaving_date = move.day;
      cancelForms(owner.id);
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
  // The new hire's own form (OB3): whoever is logged in, with an active staff file.
  http.get(`${API}/me/onboarding/`, () => {
    const row = me();
    if (!row) return forbidden();
    const form = latestForm(row.id);
    // An approved form stays for 30 days; a cancelled one is gone.
    const stale =
      form?.status === 'approved' &&
      Date.now() - new Date(form.reviewed_at ?? 0).getTime() > 30 * DAY;
    return form && form.status !== 'cancelled' && !stale
      ? HttpResponse.json(publicForm(form))
      : notFound();
  }),
  http.patch(`${API}/me/onboarding/`, async ({ request }) => {
    const form = myOpenForm();
    if (!form) return notFound();
    if (!EDITABLE.includes(form.status)) return closed();
    const body = (await request.json()) as Partial<OnboardingAnswers>;
    if (body.gender && !['male', 'female'].includes(body.gender))
      return invalid({ gender: ['"unspecified" is not a valid choice.'] });
    const children = body.number_of_children;
    if (typeof children === 'number' && (children < 0 || children > 20))
      return invalid({ number_of_children: ['Ensure this value is less than or equal to 20.'] });
    // Django's draft lengths for the numbers (a longer one refuses the whole draft).
    const LENGTHS = { national_code: 20, id_number: 20, iban: 40, emergency_phone: 20 } as const;
    for (const [key, max] of Object.entries(LENGTHS))
      if ((body[key as keyof typeof LENGTHS] ?? '').length > max)
        return invalid({
          [key]: [`Ensure this field has no more than ${String(max)} characters.`],
        });
    for (const key of Object.keys(EMPTY_ANSWERS) as (keyof OnboardingAnswers)[])
      if (key in body) Object.assign(form.answers, { [key]: body[key] });
    return HttpResponse.json(publicForm(form));
  }),
  http.post(`${API}/me/onboarding/files/`, async ({ request }) => {
    const form = myOpenForm();
    if (!form) return notFound();
    if (!EDITABLE.includes(form.status)) return closed();
    const data = await request.formData();
    const kind = data.get('kind') as OnboardingFileKind | null;
    const file = data.get('file');
    if (!kind || !(file instanceof File)) return invalid({ file: ['No file was submitted.'] });
    if (form.files.length >= 10) return invalid({ file: ['A form takes up to 10 files.'] });
    const id = newId();
    form.files.push({ id, kind, name: file.name, url: `/media/hr/onboarding/${String(id)}` });
    return HttpResponse.json(publicForm(form), { status: 201 });
  }),
  http.delete(`${API}/me/onboarding/files/:id/`, ({ params }) => {
    const form = myOpenForm();
    if (!form) return notFound();
    if (!EDITABLE.includes(form.status)) return closed();
    form.files = form.files.filter((file) => file.id !== Number(params.id));
    return HttpResponse.json(publicForm(form));
  }),
  http.post(`${API}/me/onboarding/submit/`, () => {
    const form = myOpenForm();
    const row = me();
    if (!form || !row) return notFound();
    if (!EDITABLE.includes(form.status)) return closed();
    const errors: Record<string, string[]> = {};
    const { answers } = form;
    const studies = answers.education !== null && answers.education !== 'below_diploma';
    for (const key of Object.keys(EMPTY_ANSWERS) as (keyof OnboardingAnswers)[]) {
      if (key === 'preferred_name') continue;
      if (!studies && (key === 'field_of_study' || key === 'university')) continue;
      const value = answers[key];
      if (value === null || value === '') errors[key] = ['This field is required.'];
    }
    Object.assign(errors, clashes(row, answers));
    const kinds: OnboardingFileKind[] = ['birth_certificate', 'national_card'];
    if (kinds.some((kind) => !form.files.some((file) => file.kind === kind)))
      errors.files = ['Upload the birth certificate and the national card.'];
    if (Object.keys(errors).length) return invalid(errors);
    form.status = 'submitted';
    form.submitted_at = new Date().toISOString();
    setStep(form, true);
    return HttpResponse.json(publicForm(form));
  }),
  // HR's side (OB4).
  http.get(`${API}/staff/:id/onboarding/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const form = latestForm(Number(params.id));
    return form ? HttpResponse.json(publicForm(form)) : notFound();
  }),
  http.post(`${API}/staff/:id/onboarding/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    if (!row?.is_active) return notFound();
    if (openFormOf(row.id))
      return HttpResponse.json({ detail: 'A form is already open.' }, { status: 409 });
    openForm(row, null);
    return HttpResponse.json(fileOf(row), { status: 201 });
  }),
  http.post(`${API}/staff/:id/onboarding/:action/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = find(params.id);
    const form = row && openFormOf(row.id);
    if (!row || !form) return notFound();
    const now = new Date().toISOString();
    switch (params.action) {
      case 'approve': {
        if (form.status !== 'submitted') return closed();
        const { answers } = form;
        const clash = clashes(row, answers);
        if (Object.keys(clash).length) return invalid(clash);
        row.name = `${answers.first_name} ${answers.last_name}`;
        Object.assign(row.info, {
          full_name: row.name,
          national_code: answers.national_code,
          id_number: answers.id_number,
          fathers_name: answers.fathers_name,
          birth_date: answers.birth_date,
          birth_place: answers.birth_place,
          marital_status: answers.marital_status,
          number_of_children: answers.number_of_children,
          address: answers.address,
        });
        row.birth_date = answers.birth_date;
        row.personal = {
          gender: answers.gender,
          preferred_name: answers.preferred_name,
          first_name_en: answers.first_name_en,
          last_name_en: answers.last_name_en,
          id_issue_place: answers.id_issue_place,
          education: answers.education,
          field_of_study: answers.field_of_study,
          university: answers.university,
          military_status: answers.military_status,
          iban: answers.iban,
          bank_name: answers.bank_name,
          emergency_name: answers.emergency_name,
          emergency_relation: answers.emergency_relation,
          emergency_phone: answers.emergency_phone,
        };
        for (const file of form.files)
          row.documents.push({
            id: newId(),
            type:
              file.kind === 'national_card'
                ? { id: 1, name: 'کارت ملی' }
                : { id: 3, name: 'شناسنامه' },
            url: file.url,
          });
        form.status = 'approved';
        break;
      }
      case 'return': {
        if (form.status !== 'submitted') return closed();
        const { note } = (await request.json()) as { note?: string };
        if (!note?.trim()) return invalid({ note: ['This field is required.'] });
        form.status = 'returned';
        form.note = note.trim();
        setStep(form, false);
        break;
      }
      case 'cancel':
        form.status = 'cancelled';
        break;
      default:
        return invalid({ detail: ['Unknown action.'] });
    }
    form.reviewed_at = now;
    form.reviewed_by = ME.name;
    return HttpResponse.json(fileOf(row));
  }),
];

/** Test helper: the staff member's open form filled in and sent, as a hire would (OB3). */
export function mockSubmittedForm(staffId: number) {
  const form = openFormOf(staffId);
  if (!form) throw new Error(`No open form for staff ${String(staffId)}`);
  Object.assign(form.answers, {
    first_name_en: 'Bahar',
    last_name_en: 'Niko',
    fathers_name: 'حسن',
    national_code: '0499370899',
    gender: 'female',
    id_issue_place: 'تهران',
    education: 'bachelor',
    field_of_study: 'مدیریت',
    university: 'دانشگاه تهران',
    marital_status: 'single',
    number_of_children: 0,
    military_status: 'not_applicable',
    iban: 'IR820540102680020817909002',
    bank_name: 'ملت',
    email: 'bahar.niko@gmail.com',
    address: 'تهران، خیابان آزادی',
    emergency_name: 'مریم نیکو',
    emergency_relation: 'مادر',
    emergency_phone: '09121234567',
  } satisfies Partial<OnboardingAnswers>);
  form.files = [
    { id: newId(), kind: 'birth_certificate', name: 'shenasname.pdf', url: '/media/hr/1.pdf' },
    { id: newId(), kind: 'national_card', name: 'melli.jpg', url: '/media/hr/2.jpg' },
  ];
  form.status = 'submitted';
  form.submitted_at = new Date().toISOString();
  setStep(form, true);
}
