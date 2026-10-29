import { http, HttpResponse } from 'msw';
import type { SessionUser } from '@/lib/auth/session';
import { accountHandlers, resetAccountMocks } from './account';
import { activityHandlers, resetActivityMocks } from './activities';
import { applicantHandlers, resetApplicantMocks } from './applicant';
import { assistantHandlers, resetAssistantMocks } from './assistant';
import { handoffHandlers, resetHandoffMocks } from './handoff';
import { resetSalesMocks, salesHandlers } from './sales';
import { salesCustomerHandlers } from './salesCustomer';
import { managerHandlers, resetManagerMocks } from './salesManager';
import { resetSupervisorMocks, supervisorHandlers } from './supervisor';
import { resetTaskMocks, taskHandlers } from './tasks';
import { storage } from './session';
import { resetSessionSummaries, sessionSummaryHandlers } from './sessionSummaries';
import { resetWriterMocks, writerHandlers } from './writer';
import { salesStaffHandlers } from './salesStaff';
import { taskReactionHandlers } from './taskReactions';
import { resetStaffMocks, staffHandlers } from './staff';

/**
 * Fake Django for the integration tests (src/test/server.ts); the app itself always talks to Django.
 * Mirrors the real behaviour of user_profile/authentication/views.py, including the session-held
 * login state and the response `code`s. When an endpoint ships or changes, mirror it here.
 *
 * Mock accounts (SMS code 123456, password password123):
 *   09120000000 / sara.ahmadi@scorize.local    applicant only
 *   09120000001 / maryam.kazemi@scorize.local  staff: supervisor + writer (panel switcher); her
 *                                               cases and tasks: src/mocks/supervisor.ts, her
 *                                               writing orders: src/mocks/writer.ts; assigns new
 *                                               cases (src/mocks/handoff.ts)
 *   09120000002 / nima.rostami@scorize.local   staff: sales only (no switcher)
 *   09120000003 / reza.kamrani@scorize.local   staff: sales manager (sales panel + manager section)
 *   09120000004 / bahar.nouri@scorize.local    founder (group Founders): the founders panel's
 *                                               assistant (src/mocks/assistant.ts)
 */

export const MOCK_OTP = '123456';
const MOCK_PASSWORD = 'password123';

interface MockUser extends SessionUser {
  password: string;
}

const customer = {
  staff: null,
  is_superuser: false,
  permissions: [],
  group_permissions: [],
  applicant: null,
  is_country_supervisor: false,
};
/** Each login starts with no saved panel (whoami R6); `PATCH workspace/` changes it. */
const workspace = () => ({ last_workspace: null, workspace_mode: 'last' as const });

const users: MockUser[] = [
  {
    id: 1,
    first_name: 'سارا',
    last_name: 'احمدی',
    email: 'sara.ahmadi@scorize.local',
    phone_number: '09120000000',
    password: MOCK_PASSWORD,
    ...customer,
    ...workspace(),
    applicant: {
      contract_status: 'active',
      accepted_the_terms: true,
      has_admission_features: true,
      has_visa_features: false,
      has_writing_features: true,
    },
  },
  {
    // Staff with two roles: executive team (supervisor panel) + SOP writer (writer panel).
    id: 2,
    first_name: 'مریم',
    last_name: 'کاظمی',
    email: 'maryam.kazemi@scorize.local',
    phone_number: '09120000001',
    password: MOCK_PASSWORD,
    staff: { id: 7, full_name: 'مریم کاظمی', team: 1, is_active: true },
    applicant: null,
    is_country_supervisor: false,
    ...workspace(),
    is_superuser: false,
    // Writes SOPs (and personal statements) and CVs: the writer panel.
    permissions: [
      { codename: 'can_write_sop' },
      { codename: 'can_write_ps' },
      { codename: 'can_write_cv' },
      // Hands new cases to supervisors (the supervisor panel's "New cases").
      { codename: 'can_assign_supervisor' },
    ],
    group_permissions: [],
  },
  {
    // One work panel: goes straight to it, no switcher.
    id: 3,
    first_name: 'نیما',
    last_name: 'رستمی',
    email: 'nima.rostami@scorize.local',
    phone_number: '09120000002',
    password: MOCK_PASSWORD,
    staff: { id: 8, full_name: 'نیما رستمی', team: 0, is_active: true },
    applicant: null,
    is_country_supervisor: false,
    ...workspace(),
    is_superuser: false,
    permissions: [],
    group_permissions: [],
  },
  {
    // Sales manager: the sales panel with its manager section.
    id: 4,
    first_name: 'رضا',
    last_name: 'کامرانی',
    email: 'reza.kamrani@scorize.local',
    phone_number: '09120000003',
    password: MOCK_PASSWORD,
    staff: { id: 9, full_name: 'رضا کامرانی', team: 0, is_active: true },
    applicant: null,
    is_country_supervisor: false,
    ...workspace(),
    is_superuser: false,
    permissions: [{ codename: 'can_assign_to_seller' }],
    group_permissions: [],
  },
  {
    // A partner: the Founders group gives the analysis assistant (the founders panel).
    id: 5,
    first_name: 'بهار',
    last_name: 'نوری',
    email: 'bahar.nouri@scorize.local',
    phone_number: '09120000004',
    password: MOCK_PASSWORD,
    ...customer,
    ...workspace(),
    group_permissions: [
      { name: 'Founders', permissions: [{ codename: 'use_founders_assistant' }] },
    ],
  },
];

// Server-side login state (Django keeps this in the session).
let flow: { email?: string; phone?: string; otpSentAt?: number; tries: number } | null = null;

const code = (value: number, status = 200, extra: object = {}) =>
  HttpResponse.json({ code: value, ...extra }, { status });

const publicUser = ({ password: _password, ...user }: MockUser): SessionUser => user;

const login = (user: MockUser) => {
  storage.set(user.id);
  flow = null;
  return code(17, 200, { id: user.id, credit: 0 });
};

const AUTH = '/profile/authentication';
export const handlers = [
  ...sessionSummaryHandlers,
  ...activityHandlers,
  http.get('/api/profile/auth/v1/whoami/', () => {
    const user = users.find((candidate) => candidate.id === storage.get());
    return user
      ? HttpResponse.json(publicUser(user))
      : HttpResponse.json(
          { detail: 'Authentication credentials were not provided.' },
          { status: 403 },
        );
  }),

  // The panel's choice of what opens after login (R6).
  http.patch('/api/profile/auth/v1/workspace/', async ({ request }) => {
    const user = users.find((candidate) => candidate.id === storage.get());
    if (!user) return HttpResponse.json({ detail: 'Not logged in.' }, { status: 403 });
    const change = (await request.json()) as Pick<SessionUser, 'last_workspace' | 'workspace_mode'>;
    Object.assign(user, change);
    return HttpResponse.json({
      last_workspace: user.last_workspace,
      workspace_mode: user.workspace_mode,
    });
  }),

  // Only sets the CSRF cookie (A9).
  http.get(
    '/api/profile/auth/v1/csrf/',
    () =>
      new HttpResponse(null, {
        status: 204,
        headers: { 'Set-Cookie': 'csrftoken=mock-csrf; Path=/' },
      }),
  ),

  http.post('/api/profile/auth/v1/logout/', () => {
    storage.set(null);
    resetApplicantMocks();
    resetAccountMocks();
    resetSalesMocks();
    resetTaskMocks();
    resetManagerMocks();
    resetHandoffMocks();
    resetWriterMocks();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${AUTH}/begin/`, async ({ request }) => {
    const body = (await request.json()) as { phone_number?: string; email?: string };
    if (!body.phone_number === !body.email) return code(5, 400, { errors: {} });
    flow = {
      tries: 0,
      ...(body.phone_number ? { phone: body.phone_number } : { email: body.email ?? '' }),
    };
    const user = users.find((candidate) =>
      body.phone_number
        ? candidate.phone_number === body.phone_number
        : candidate.email === body.email,
    );
    if (!user) return code(8, 404);
    return code(body.phone_number ? 9 : 10);
  }),

  http.post(`${AUTH}/send-otp/`, () => {
    if (!flow) return code(3, 400);
    if (!flow.phone) return code(4, 400, { required_method: 0 });
    if (flow.otpSentAt && Date.now() - flow.otpSentAt < 100_000) return code(12, 429);
    flow.otpSentAt = Date.now();
    flow.tries = 0;
    console.info(`[mock] SMS code for ${flow.phone}: ${MOCK_OTP}`);
    return code(13, 201);
  }),

  http.post(`${AUTH}/otp/`, async ({ request }) => {
    if (!flow) return code(3, 400);
    if (!flow.phone) return code(4, 400, { required_method: 0 });
    const { otp } = (await request.json()) as { otp?: string };
    if (++flow.tries > 5) return code(15, 429);
    if (!flow.otpSentAt) return code(14, 404);
    if (otp !== MOCK_OTP) return code(16, 403);
    const user = users.find((candidate) => candidate.phone_number === flow?.phone);
    return user ? login(user) : code(8, 404);
  }),

  http.post(`${AUTH}/password/`, async ({ request }) => {
    if (!flow) return code(3, 400);
    if (!flow.email) return code(4, 400, { required_method: 1 });
    const { password } = (await request.json()) as { password?: string };
    const user = users.find((candidate) => candidate.email === flow?.email);
    if (!user) return code(8, 404);
    return user.password === password ? login(user) : code(11, 403);
  }),

  http.post(`${AUTH}/pre-registration-check/`, async ({ request }) => {
    if (!flow) return code(3, 400);
    const body = (await request.json()) as { email: string; phone_number: string };
    const errors: Record<string, string[]> = {};
    if (users.some((user) => user.email === body.email)) errors.email = ['duplicate'];
    if (users.some((user) => user.phone_number === body.phone_number))
      errors.phone_number = ['duplicate'];
    if (Object.keys(errors).length) return code(5, 400, { errors });
    // Like Django: keep the identifier stored by begin/, fill in the other one.
    flow.email ??= body.email;
    flow.phone ??= body.phone_number;
    return code(2);
  }),

  http.post(`${AUTH}/registration/`, async ({ request }) => {
    if (!flow) return code(3, 400);
    if (!flow.phone || !flow.email) return code(4, 400);
    const body = (await request.json()) as { otp?: string; first_name: string; last_name: string };
    if (++flow.tries > 5) return code(15, 429);
    if (!flow.otpSentAt) return code(14, 404);
    if (body.otp !== MOCK_OTP) return code(16, 403);
    const user: MockUser = {
      id: users.length + 1,
      first_name: body.first_name,
      last_name: body.last_name,
      email: flow.email,
      phone_number: flow.phone,
      password: MOCK_PASSWORD,
      ...customer,
      ...workspace(),
    };
    users.push(user);
    return login(user);
  }),

  http.post(`${AUTH}/begin-password-reset/`, () => {
    if (!flow) return code(3, 400);
    if (!flow.email) return code(4, 400, { required_method: 1 });
    return code(18, 201);
  }),

  http.post(`${AUTH}/password-reset/`, async ({ request }) => {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
      password_confirmation?: string;
    };
    if (body.token !== '00000000-0000-0000-0000-000000000000') return code(20, 404);
    if (!body.password || body.password !== body.password_confirmation || body.password.length < 8)
      return code(5, 400, { errors: { password: ['invalid'] } });
    return code(21);
  }),

  // Django's existing staff API first: the sales endpoints below are computed from its records.
  ...staffHandlers,
  // Reactions for every panel's tasks, before the sellers' generic task actions.
  ...taskReactionHandlers,
  ...salesStaffHandlers,
  ...applicantHandlers,
  ...accountHandlers,
  ...salesHandlers,
  ...salesCustomerHandlers,
  ...managerHandlers,
  ...taskHandlers,
  ...supervisorHandlers,
  ...handoffHandlers,
  ...writerHandlers,
  ...assistantHandlers,
];

/** Test helper: forget the mock login session and server-side flow. */
export function resetMockSession() {
  resetSessionSummaries();
  resetActivityMocks();
  storage.set(null);
  flow = null;
  for (const user of users) Object.assign(user, workspace());
  resetApplicantMocks();
  resetAccountMocks();
  resetSalesMocks();
  resetTaskMocks();
  resetManagerMocks();
  resetSupervisorMocks();
  resetHandoffMocks();
  resetWriterMocks();
  resetStaffMocks();
  resetAssistantMocks();
}

type Workspace = Pick<SessionUser, 'last_workspace' | 'workspace_mode'>;

/** Test helper: what a mock account saved as its panel after login (whoami R6). */
export function mockWorkspace(id: number): Workspace {
  const user = users.find((candidate) => candidate.id === id);
  return {
    last_workspace: user?.last_workspace ?? null,
    workspace_mode: user?.workspace_mode ?? 'last',
  };
}

/** Test helper: a mock account's saved panel choice, as if set on another device. */
export function setMockWorkspace(id: number, change: Partial<Workspace>) {
  const user = users.find((candidate) => candidate.id === id);
  if (user) Object.assign(user, change);
}
