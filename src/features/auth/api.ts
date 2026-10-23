import { ApiError, request } from '@/lib/api/client';
import type { AuthCode } from './codes';

/**
 * Django's session-based login API (user_profile/authentication/views.py), reused as is.
 * Each step stores state in the Django session, so calls must follow the documented order
 * (docs/backend-integration.md).
 */
const AUTH_BASE = '/profile/authentication';

export type FieldErrors = Partial<Record<string, unknown>>;

export interface AuthResult {
  code: AuthCode;
  status: number;
  /** Per-field validation errors (keys = field names). Server text is not shown to users. */
  errors?: FieldErrors;
}

async function post(step: string, body?: object): Promise<AuthResult> {
  const { status, data } = await request(`${AUTH_BASE}/${step}/`, { method: 'POST', body });
  const payload = data as { code?: unknown; errors?: unknown } | null;
  // Anything without a numeric code (HTML error page, proxy error, CSRF failure) is unexpected.
  if (typeof payload?.code !== 'number') throw new ApiError(status, data);
  const errors =
    payload.errors && typeof payload.errors === 'object'
      ? (payload.errors as FieldErrors)
      : undefined;
  return { code: payload.code as AuthCode, status, ...(errors ? { errors } : {}) };
}

export type Identifier = { type: 'phone'; value: string } | { type: 'email'; value: string };

export interface RegistrationDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

export const authApi = {
  /** Starts a login: answers SEND_OTP (phone), ENTER_PASSWORD (email) or USER_DOES_NOT_EXIST. */
  begin: (identifier: Identifier) =>
    post(
      'begin',
      identifier.type === 'phone'
        ? { phone_number: identifier.value }
        : { email: identifier.value },
    ),
  sendOtp: () => post('send-otp'),
  verifyOtp: (otp: string) => post('otp', { otp }),
  password: (password: string) => post('password', { password }),
  preRegister: (details: RegistrationDetails) => post('pre-registration-check', details),
  register: (otp: string, names: Pick<RegistrationDetails, 'first_name' | 'last_name'>) =>
    post('registration', { otp, ...names }),
  beginPasswordReset: () => post('begin-password-reset'),
  resetPassword: (token: string, password: string, passwordConfirmation: string) =>
    post('password-reset', { token, password, password_confirmation: passwordConfirmation }),
};
