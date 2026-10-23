import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { formatPhone } from '@/lib/site';
import { OTP_LENGTH, OTP_LIFETIME_SECONDS } from '../codes';
import { toLatinDigits } from '../identifier';
import { OtpInput } from './OtpInput';
import { StepHeader } from './StepHeader';
import { BackButton, Identifier, SignupProgress, StepNote } from './StepParts';

interface Props {
  phone: string;
  sentAt: number;
  purpose: 'login' | 'register';
  pending: boolean;
  /** Server answer for the last code (wrong, expired, …), shown under the boxes. */
  error: string | undefined;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onChangePhone: () => void;
  /** The user changed the code: the last error no longer applies. */
  onEdit: () => void;
}

const secondsLeft = (sentAt: number, now: number) =>
  Math.min(
    OTP_LIFETIME_SECONDS,
    Math.max(0, OTP_LIFETIME_SECONDS - Math.floor((now - sentAt) / 1000)),
  );

/** Minimal typing for the WebOTP API (Chrome on Android), not yet in TypeScript's DOM types. */
interface OtpCredential extends Credential {
  code: string;
}

export function OtpStep({
  phone,
  sentAt,
  purpose,
  pending,
  error,
  onSubmit,
  onResend,
  onChangePhone,
  onEdit,
}: Props) {
  const { t } = useTranslation('auth');
  const format = useFormat();
  const inputId = useId();
  const [code, setCode] = useState('');
  const [incomplete, setIncomplete] = useState(false);
  const [now, setNow] = useState(Date.now);
  const remaining = secondsLeft(sentAt, now);
  const lastSubmitted = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const message =
    error ?? (incomplete ? t('otp.incomplete', { length: format.number(OTP_LENGTH) }) : undefined);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Wrong code: select it, so typing the right one replaces it.
  useEffect(() => {
    if (error) input.current?.select();
  }, [error]);

  const submitCode = (value: string) => {
    if (value.length !== OTP_LENGTH) {
      setIncomplete(true);
      return;
    }
    lastSubmitted.current = value;
    onSubmit(value);
  };

  // Android Chrome: read the code from the SMS when it arrives (needs the SMS format in A10).
  useEffect(() => {
    if (!('OTPCredential' in window)) return;
    const controller = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: controller.signal } as CredentialRequestOptions)
      .then((credential) => {
        const value = (credential as OtpCredential | null)?.code;
        if (value) {
          setCode(value);
          submitCode(value);
        }
      })
      .catch(() => {
        // Aborted, denied or unsupported: the user types the code instead.
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per sent code
  }, [sentAt]);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    submitCode(code);
  };

  // Wrapped in U+2066…U+2069 (left-to-right isolate) where shown, so RTL text doesn't reorder it.
  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-[26px]">
      <BackButton onClick={onChangePhone}>{t('otp.changePhone')}</BackButton>
      <div className="flex flex-col gap-2.5">
        {purpose === 'register' && <SignupProgress current={2} />}
        <StepHeader title={t('otp.title')}>
          <Trans
            ns="auth"
            i18nKey="otp.subtitle"
            values={{ length: format.number(OTP_LENGTH), phone: format.digits(formatPhone(phone)) }}
            components={{ id: <Identifier /> }}
          />
        </StepHeader>
      </div>
      <div className="flex flex-col gap-3">
        <label htmlFor={inputId} className="sr-only">
          {t('otp.label')}
        </label>
        <OtpInput
          ref={input}
          id={inputId}
          name="otp"
          autoFocus
          invalid={Boolean(message)}
          aria-describedby={message ? `${inputId}-message` : undefined}
          value={code}
          onChange={(raw) => {
            const value = toLatinDigits(raw).replace(/\D/g, '').slice(0, OTP_LENGTH);
            setCode(value);
            setIncomplete(false);
            if (error) onEdit();
            // Submit as soon as the last digit is typed or pasted (once per code).
            if (value.length === OTP_LENGTH && value !== lastSubmitted.current && !pending) {
              submitCode(value);
            }
          }}
        />
        {message && (
          <p
            id={`${inputId}-message`}
            role="alert"
            className="m-0 flex items-center gap-2 text-sm font-medium text-danger"
          >
            <Icon name="alert" size={16} className="flex-none" />
            {message}
          </p>
        )}
        <p className="m-0 flex min-h-11 flex-wrap items-center gap-x-2 text-sm text-text-2">
          {remaining > 0 ? (
            <span aria-live="off">
              {t('otp.resendIn', { time: `\u2066${format.digits(countdown)}\u2069` })}
            </span>
          ) : (
            <>
              <span>{t('otp.notReceived')}</span>
              <button
                type="button"
                onClick={onResend}
                disabled={pending}
                className="min-h-11 font-semibold text-primary-text hover:underline"
              >
                {t('otp.resend')}
              </button>
            </>
          )}
        </p>
      </div>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
        {t(purpose === 'register' ? 'otp.submitRegister' : 'otp.submit')}
      </Button>
      <StepNote icon="shield" tone="warn">
        {t('otp.neverShare')}
      </StepNote>
    </form>
  );
}
