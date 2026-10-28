import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { OtpInput } from '@/components/ui/OtpInput';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import {
  isWrongCode,
  useSendPledgeCode,
  useSignPledge,
  type TurkeyCase,
} from '@/lib/applicant/turkey';

type Problem = 'acceptFirst' | 'codeIncomplete' | 'wrongCode' | 'error' | 'sendError';

/**
 * Signing the Turkey pledge: tick that you accept, get a code by SMS and sign with it. The server
 * keeps the time, the phone and the text's `version` with the signature. On the Turkey page under
 * the pledge's text, and on the documents tab's Turkey card once every document is approved.
 */
export function PledgeForm({
  data,
  pledge,
  className = '',
}: {
  data: TurkeyCase;
  pledge: NonNullable<TurkeyCase['pledge']>;
  className?: string;
}) {
  const { t } = useTranslation('turkey');
  const f = useFormat();
  const sendCode = useSendPledgeCode();
  const sign = useSignPledge();
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const codeId = useId();
  const errorId = `${codeId}-error`;
  // Left to right inside Persian text, or the masked number ("0912•••6789") reads backwards.
  const phone = `\u2066${f.digits(data.phone)}\u2069`;
  const sent = resendAt !== null;
  const wait = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  const requestCode = () => {
    setProblem(null);
    sendCode.mutate(undefined, {
      onSuccess: ({ resend_in }) => {
        setNow(Date.now());
        setResendAt(Date.now() + resend_in * 1000);
        setCode('');
      },
      onError: () => setProblem('sendError'),
    });
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!accepted) {
      setProblem('acceptFirst');
      return;
    }
    if (code.length !== pledge.code_length) {
      setProblem('codeIncomplete');
      return;
    }
    setProblem(null);
    sign.mutate(
      { code, version: pledge.version },
      { onError: (error) => setProblem(isWrongCode(error) ? 'wrongCode' : 'error') },
    );
  };

  const clock = `${f.number(Math.floor(wait / 60)).padStart(2, f.number(0))}:${f
    .number(wait % 60)
    .padStart(2, f.number(0))}`;
  const message =
    problem &&
    t(
      `sign.${problem}`,
      problem === 'codeIncomplete' ? { length: f.number(pledge.code_length) } : {},
    );

  return (
    <form noValidate onSubmit={submit} className={`flex flex-col gap-5 ${className}`}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-medium">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => {
            setAccepted(event.target.checked);
            if (problem === 'acceptFirst') setProblem(null);
          }}
          className="size-5 accent-primary"
        />
        {t('sign.accept')}
      </label>

      {sent ? (
        <div className="flex flex-col gap-2.5">
          <label htmlFor={codeId} className="text-[15px] font-medium">
            {t('sign.codeLabel', { phone })}
          </label>
          <div className="max-w-[360px]">
            <OtpInput
              id={codeId}
              length={pledge.code_length}
              value={code}
              invalid={problem === 'wrongCode' || problem === 'codeIncomplete'}
              aria-describedby={problem ? errorId : undefined}
              onChange={(raw) => {
                setCode(toLatinDigits(raw).replace(/\D/g, '').slice(0, pledge.code_length));
                if (problem === 'wrongCode' || problem === 'codeIncomplete') setProblem(null);
              }}
            />
          </div>
          {wait > 0 ? (
            <span className="text-sm text-text-2" aria-live="off">
              {t('sign.resendIn', { time: clock })}
            </span>
          ) : (
            <button
              type="button"
              onClick={requestCode}
              disabled={sendCode.isPending}
              className="min-h-11 self-start text-sm font-semibold text-primary-text"
            >
              {t('sign.resend')}
            </button>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={requestCode}
          disabled={sendCode.isPending}
          className="self-start"
        >
          {t('sign.sendCode', { phone })}
        </Button>
      )}

      {message && (
        <div id={errorId}>
          <Notice tone="error">{message}</Notice>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!sent || sign.isPending}>
          {sign.isPending ? t('sign.signing') : t('sign.submit')}
        </Button>
        <span className="text-center text-[13px] leading-6 text-text-2">{t('sign.record')}</span>
      </div>
    </form>
  );
}
