import { useQueryClient } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { NetworkError } from '@/lib/api/client';
import { START_PATH, sessionQuery } from '@/lib/auth/session';
import { authApi, type AuthResult, type Identifier, type RegistrationDetails } from './api';
import { AuthCode, RESTART_CODES, SUCCESS_CODES } from './codes';
import { safeNextPath, toRouterPath } from './next';

type Names = Pick<RegistrationDetails, 'first_name' | 'last_name'>;

export type Step =
  | { name: 'identify'; initial: string }
  | { name: 'otp'; phone: string; sentAt: number; purpose: 'login' }
  | { name: 'otp'; phone: string; sentAt: number; purpose: 'register'; names: Names }
  | { name: 'password'; email: string }
  | { name: 'register'; identifier: Identifier }
  | { name: 'resetSent'; email: string }
  | { name: 'resetPassword'; token: string }
  | { name: 'resetDone' }
  /** Account just created: a short "start here" before entering the panel. */
  | { name: 'welcome'; firstName: string };

export type AuthMessage = ParseKeys<'auth'>;

export interface Feedback {
  tone: 'error' | 'info' | 'success';
  message: AuthMessage;
  /** Numbers the message shows ("{{n}} tries left", "in {{minutes}} minutes"). */
  values?: Record<string, number>;
}

/**
 * The whole login / sign-up / password-reset flow as a small state machine.
 * Steps follow Django's session-based API; every server answer is handled by its `code`.
 */
export function useAuthFlow({
  next,
  resetToken,
}: {
  next: string | null;
  resetToken: string | null;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(
    resetToken ? { name: 'resetPassword', token: resetToken } : { name: 'identify', initial: '' },
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  // A ref, not state: blocks a second submit fired before React re-renders (double tap, Enter + click).
  const busy = useRef(false);

  const go = (nextStep: Step, nextFeedback: Feedback | null = null) => {
    setStep(nextStep);
    setFeedback(nextFeedback);
    setFieldErrors([]);
  };
  const fail = (message: AuthMessage, values?: Record<string, number>) => {
    setFeedback({ tone: 'error', message, ...(values ? { values } : {}) });
  };

  const finish = async () => {
    // A different account may have been cached in this tab: start from a clean slate.
    queryClient.clear();
    await queryClient.query({ ...sessionQuery, staleTime: 0 });
    // No `next`: the router picks the user's panel (staff land in their work panel).
    if (!next) {
      await navigate(START_PATH, { replace: true });
      return;
    }
    const target = safeNextPath(next);
    const routerPath = toRouterPath(target);
    if (routerPath) await navigate(routerPath, { replace: true });
    else window.location.assign(target);
  };

  /** Outcomes every step shares. Returns true when the result was handled. */
  const handleCommon = async (result: AuthResult) => {
    if (SUCCESS_CODES.includes(result.code)) {
      await finish();
      return true;
    }
    if (RESTART_CODES.includes(result.code)) {
      go({ name: 'identify', initial: '' }, { tone: 'error', message: 'errors.sessionExpired' });
      return true;
    }
    if (result.code === AuthCode.INACTIVE_USER) {
      fail('errors.inactive');
      return true;
    }
    if (result.code === AuthCode.RECAPTCHA_FAILED) {
      fail('errors.captcha');
      return true;
    }
    if (result.code === AuthCode.TOO_MANY_REQUESTS) {
      fail('errors.tooManyRequests', {
        minutes: Math.max(1, Math.ceil((result.retry_after ?? 60) / 60)),
      });
      return true;
    }
    return false;
  };

  /** Runs one server action at a time; UI handlers call it and don't wait (errors land in feedback). */
  const run = useCallback((action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFeedback(null);
    void (async () => {
      try {
        await action();
      } catch (error) {
        if (!(error instanceof NetworkError)) console.error(error);
        setFeedback({
          tone: 'error',
          message: error instanceof NetworkError ? 'errors.network' : 'errors.unexpected',
        });
      } finally {
        busy.current = false;
        setPending(false);
      }
    })();
  }, []);

  const sendCode = async (
    phone: string,
    then: Extract<Step, { name: 'otp' }>['purpose'],
    names?: Names,
  ) => {
    const result = await authApi.sendOtp();
    if (await handleCommon(result)) return;
    if (result.code !== AuthCode.OTP_SENT && result.code !== AuthCode.OTP_TIMEOUT) {
      fail('errors.unexpected');
      return;
    }
    const sentAt = Date.now();
    const otpStep: Step =
      then === 'register' && names
        ? { name: 'otp', phone, sentAt, purpose: 'register', names }
        : { name: 'otp', phone, sentAt, purpose: 'login' };
    // OTP_TIMEOUT: a code sent moments ago is still valid, so the user can use it.
    go(
      otpStep,
      result.code === AuthCode.OTP_TIMEOUT ? { tone: 'info', message: 'errors.otpTimeout' } : null,
    );
  };

  const actions = {
    identify: (identifier: Identifier) =>
      run(async () => {
        const result = await authApi.begin(identifier);
        if (await handleCommon(result)) return;
        switch (result.code) {
          case AuthCode.SEND_OTP:
            await sendCode(identifier.value, 'login');
            return;
          case AuthCode.ENTER_PASSWORD:
            go({ name: 'password', email: identifier.value });
            return;
          case AuthCode.USER_DOES_NOT_EXIST:
            go({ name: 'register', identifier });
            return;
          case AuthCode.INVALID_DATA:
            fail('identify.invalid');
            return;
          default:
            fail('errors.unexpected');
        }
      }),

    verifyOtp: (otp: string) =>
      run(async () => {
        if (step.name !== 'otp') return;
        const result =
          step.purpose === 'register'
            ? await authApi.register(otp, step.names)
            : await authApi.verifyOtp(otp);
        if (step.purpose === 'register' && SUCCESS_CODES.includes(result.code)) {
          go({ name: 'welcome', firstName: step.names.first_name });
          return;
        }
        if (await handleCommon(result)) return;
        switch (result.code) {
          case AuthCode.INVALID_OTP:
            if (result.tries_left !== undefined && result.tries_left > 0)
              fail('errors.invalidOtpTries', { n: result.tries_left });
            else fail('errors.invalidOtp');
            return;
          case AuthCode.OTP_EXPIRED:
            fail('errors.otpExpired');
            return;
          case AuthCode.OTP_MAX_TRY_EXCEEDED:
            fail('errors.otpTooManyTries');
            return;
          case AuthCode.DUPLICATE_USER:
            go(
              { name: 'identify', initial: step.phone },
              { tone: 'error', message: 'errors.duplicate' },
            );
            return;
          case AuthCode.USER_DOES_NOT_EXIST:
            go(
              { name: 'identify', initial: step.phone },
              { tone: 'error', message: 'errors.userNotFound' },
            );
            return;
          case AuthCode.INVALID_DATA:
            fail(step.purpose === 'register' ? 'errors.invalidData' : 'errors.invalidOtp');
            return;
          default:
            fail('errors.unexpected');
        }
      }),

    resendOtp: () =>
      run(async () => {
        if (step.name !== 'otp') return;
        const result = await authApi.sendOtp();
        if (await handleCommon(result)) return;
        if (result.code === AuthCode.OTP_SENT) {
          setStep({ ...step, sentAt: Date.now() });
          setFeedback({ tone: 'success', message: 'otp.resent' });
        } else if (result.code === AuthCode.OTP_TIMEOUT) {
          setFeedback({ tone: 'info', message: 'errors.otpTimeout' });
        } else {
          fail('errors.unexpected');
        }
      }),

    password: (password: string) =>
      run(async () => {
        const result = await authApi.password(password);
        if (await handleCommon(result)) return;
        switch (result.code) {
          case AuthCode.INVALID_PASSWORD:
            fail('errors.invalidPassword');
            return;
          case AuthCode.USER_DOES_NOT_EXIST:
            fail('errors.userNotFound');
            return;
          case AuthCode.INVALID_DATA:
            fail('errors.invalidData');
            return;
          default:
            fail('errors.unexpected');
        }
      }),

    forgotPassword: () =>
      run(async () => {
        if (step.name !== 'password') return;
        const result = await authApi.beginPasswordReset();
        if (await handleCommon(result)) return;
        if (result.code === AuthCode.PASSWORD_RESET_STARTED)
          go({ name: 'resetSent', email: step.email });
        else if (result.code === AuthCode.USER_DOES_NOT_EXIST) fail('errors.userNotFound');
        else fail('errors.unexpected');
      }),

    register: (details: RegistrationDetails) =>
      run(async () => {
        const result = await authApi.preRegister(details);
        if (await handleCommon(result)) return;
        if (result.code === AuthCode.CREATE_USER) {
          await sendCode(details.phone_number, 'register', {
            first_name: details.first_name,
            last_name: details.last_name,
          });
        } else if (result.code === AuthCode.INVALID_DATA) {
          setFieldErrors(Object.keys(result.errors ?? {}));
          fail('errors.invalidData');
        } else {
          fail('errors.unexpected');
        }
      }),

    resetPassword: (password: string, confirmation: string) =>
      run(async () => {
        if (step.name !== 'resetPassword') return;
        const result = await authApi.resetPassword(step.token, password, confirmation);
        if (await handleCommon(result)) return;
        switch (result.code) {
          case AuthCode.PASSWORD_RESET_COMPLETE:
            go({ name: 'resetDone' });
            return;
          case AuthCode.INVALID_PASSWORD_RESET_TOKEN:
          case AuthCode.PASSWORD_RESET_TOKEN_DOES_NOT_EXIST:
            fail('reset.invalidLink');
            return;
          case AuthCode.INVALID_DATA:
            fail('reset.rejected');
            return;
          default:
            fail('errors.unexpected');
        }
      }),

    /** Back to the first step, keeping what the user typed. */
    restart: (initial = '') => {
      go({ name: 'identify', initial });
    },

    /** Email accounts log in with a password; an SMS code needs the mobile number instead. */
    useSms: () => {
      go({ name: 'identify', initial: '' }, { tone: 'info', message: 'identify.useMobile' });
    },

    /** After the welcome step. */
    enterPanel: () => {
      run(finish);
    },

    /** The user is fixing their input: hide the last error. */
    clearFeedback: () => {
      setFeedback(null);
    },
  };

  return { step, feedback, fieldErrors, pending, actions };
}
