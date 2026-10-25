/**
 * Mirror of Django's AuthenticationResponseType (user_profile/authentication/types.py).
 * Every auth response carries one of these in `code`; the UI branches on it, never on HTTP status.
 */
export const AuthCode = {
  USER_IS_AUTHENTICATED: 0,
  DUPLICATE_USER: 1,
  CREATE_USER: 2,
  AUTHENTICATION_NOT_STARTED: 3,
  INVALID_AUTHENTICATION_METHOD: 4,
  INVALID_DATA: 5,
  RECAPTCHA_FAILED: 6,
  INACTIVE_USER: 7,
  USER_DOES_NOT_EXIST: 8,
  SEND_OTP: 9,
  ENTER_PASSWORD: 10,
  INVALID_PASSWORD: 11,
  OTP_TIMEOUT: 12,
  OTP_SENT: 13,
  OTP_EXPIRED: 14,
  OTP_MAX_TRY_EXCEEDED: 15,
  INVALID_OTP: 16,
  AUTHENTICATED: 17,
  PASSWORD_RESET_STARTED: 18,
  INVALID_PASSWORD_RESET_TOKEN: 19,
  PASSWORD_RESET_TOKEN_DOES_NOT_EXIST: 20,
  PASSWORD_RESET_COMPLETE: 21,
  /** HTTP 429 with `retry_after` (seconds): too many codes or logins from this IP, phone or account. */
  TOO_MANY_REQUESTS: 22,
} as const;

export type AuthCode = (typeof AuthCode)[keyof typeof AuthCode];

/** Codes that mean the server-side login session is gone: the flow must restart from the first step. */
export const RESTART_CODES: readonly AuthCode[] = [
  AuthCode.AUTHENTICATION_NOT_STARTED,
  AuthCode.INVALID_AUTHENTICATION_METHOD,
];

/** Codes that end the flow successfully. */
export const SUCCESS_CODES: readonly AuthCode[] = [
  AuthCode.AUTHENTICATED,
  AuthCode.USER_IS_AUTHENTICATED,
];

/** Same as Django's OTP_CACHE_TIME: a code lives this long and can't be re-sent before it expires. */
export const OTP_LIFETIME_SECONDS = 100;
export const OTP_LENGTH = 6;
