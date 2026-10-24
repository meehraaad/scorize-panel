import { http, HttpResponse } from 'msw';
import type { SessionUser } from '@/lib/auth/session';
import { accountHandlers, resetAccountMocks } from './account';
import { applicantHandlers, resetApplicantMocks } from './applicant';
import { storage } from './session';

/**
 * Fake Django for working on the panel without a backend (VITE_API_MOCKS=true) and for tests.
 * Mirrors the real behaviour of user_profile/authentication/views.py, including the session-held
 * login state and the response `code`s. When an endpoint ships or changes, mirror it here.
 *
 * Mock accounts (SMS code 123456, password password123):
 *   09120000000 / sara.ahmadi@scorize.local    applicant only
 *   09120000001 / maryam.kazemi@scorize.local  staff: supervisor + writer (panel switcher)
 *   09120000002 / nima.rostami@scorize.local   staff: sales only (no switcher)
 */

export const MOCK_OTP = '123456';
const MOCK_PASSWORD = 'password123';

interface MockUser extends SessionUser {
  password: string;
}

const customer = { staff: null, is_superuser: false, permissions: [], group_permissions: [] };

const users: MockUser[] = [
  {
    id: 1,
    first_name: 'سارا',
    last_name: 'احمدی',
    email: 'sara.ahmadi@scorize.local',
    phone_number: '09120000000',
    password: MOCK_PASSWORD,
    ...customer,
  },
  {
    // Staff with two roles: executive team (supervisor panel) + SOP writer (writer panel).
    id: 2,
    first_name: 'مریم',
    last_name: 'کاظمی',
    email: 'maryam.kazemi@scorize.local',
    phone_number: '09120000001',
    password: MOCK_PASSWORD,
    staff: { id: 7, full_name: 'مریم کاظمی', team: 1 },
    is_superuser: false,
    permissions: [{ codename: 'can_write_sop' }],
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
    staff: { id: 8, full_name: 'نیما رستمی', team: 0 },
    is_superuser: false,
    permissions: [],
    group_permissions: [],
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
  http.get('/api/profile/auth/v1/whoami/', () => {
    const user = users.find((candidate) => candidate.id === storage.get());
    return user
      ? HttpResponse.json(publicUser(user))
      : HttpResponse.json(
          { detail: 'Authentication credentials were not provided.' },
          { status: 403 },
        );
  }),

  // Stands in for the old login page: only used to obtain the CSRF cookie.
  http.get(
    `${AUTH}/login/`,
    () =>
      new HttpResponse(null, {
        status: 200,
        headers: { 'Set-Cookie': 'csrftoken=mock-csrf; Path=/' },
      }),
  ),

  http.get(`${AUTH}/logout/`, () => {
    storage.set(null);
    resetApplicantMocks();
    resetAccountMocks();
    return HttpResponse.redirect('/', 302);
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

  ...applicantHandlers,
  ...accountHandlers,
];

/** Test helper: forget the mock login session and server-side flow. */
export function resetMockSession() {
  storage.set(null);
  flow = null;
  resetApplicantMocks();
  resetAccountMocks();
}
