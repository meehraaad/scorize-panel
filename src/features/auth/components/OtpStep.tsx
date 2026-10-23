import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { OTP_LENGTH, OTP_LIFETIME_SECONDS } from '../codes';
import { toLatinDigits } from '../identifier';
import { StepHeader } from './StepHeader';

interface Props {
  phone: string;
  sentAt: number;
  purpose: 'login' | 'register';
  pending: boolean;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onChangePhone: () => void;
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
  onSubmit,
  onResend,
  onChangePhone,
}: Props) {
  const { t } = useTranslation('auth');
  const format = useFormat();
  const [code, setCode] = useState('');
  const [incomplete, setIncomplete] = useState(false);
  const [now, setNow] = useState(Date.now);
  const remaining = secondsLeft(sentAt, now);
  const lastSubmitted = useRef('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <StepHeader title={t('otp.title')}>
        {t('otp.subtitle', { length: format.number(OTP_LENGTH), phone: format.digits(phone) })}
      </StepHeader>
      <TextField
        label={t('otp.label')}
        error={incomplete ? t('otp.incomplete', { length: format.number(OTP_LENGTH) }) : undefined}
        name="otp"
        type="text"
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus
        value={code}
        onChange={(event) => {
          const value = toLatinDigits(event.target.value).replace(/\D/g, '').slice(0, OTP_LENGTH);
          setCode(value);
          setIncomplete(false);
          // Submit as soon as the last digit is typed or pasted (once per code).
          if (value.length === OTP_LENGTH && value !== lastSubmitted.current && !pending) {
            submitCode(value);
          }
        }}
        className="text-center text-2xl tracking-[0.5em]"
      />
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
        {t(purpose === 'register' ? 'otp.submitRegister' : 'otp.submit')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
        {remaining > 0 ? (
          <span className="text-text-2" aria-live="off">
            {t('otp.resendIn', { seconds: format.number(remaining) })}
          </span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={pending}
            className="min-h-11 font-medium text-primary-text"
          >
            {t('otp.resend')}
          </button>
        )}
        <button
          type="button"
          onClick={onChangePhone}
          className="min-h-11 text-text-2 hover:text-text"
        >
          {t('otp.changePhone')}
        </button>
      </div>
    </form>
  );
}
