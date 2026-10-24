import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { OtpInput } from '@/components/ui/OtpInput';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { isWrongCode, useSendPledgeCode, useSignPledge, type TurkeyCase } from '../api';

const FACTS = ['country', 'services', 'fee', 'duty'] as const;

type Problem = 'acceptFirst' | 'codeIncomplete' | 'wrongCode' | 'error' | 'sendError';

/**
 * Step 4: the pledge. Read it, tick that you accept, get a code by SMS and sign with it. The server
 * keeps the time, the phone and the text's `version` with the signature.
 */
export function SignStep({
  data,
  pledge,
}: {
  data: TurkeyCase;
  pledge: NonNullable<TurkeyCase['pledge']>;
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
    <>
      <div className="flex flex-col items-start gap-2.5">
        <Chip tone="good" dot>
          {t('sign.approved')}
        </Chip>
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {t('sign.title')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">{t('sign.text')}</p>
      </div>

      <Card aria-label={t('sign.summary')} className="p-5 lg:px-7">
        <dl className="m-0 grid gap-4 sm:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact} className="flex flex-col gap-1">
              <dt className="text-[13px] text-text-2">{t(`sign.fact.${fact}.label`)}</dt>
              <dd className={`m-0 text-[15px] font-semibold ${fact === 'fee' ? 'text-good' : ''}`}>
                {t(`sign.fact.${fact}.value`)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col">
        <div
          // A scroll box keyboard users can scroll too.
          tabIndex={0}
          role="region"
          aria-label={t('sign.textLabel')}
          className="flex max-h-[360px] flex-col gap-5 overflow-y-auto p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus lg:px-7"
        >
          {pledge.clauses.map((clause) => (
            <div key={clause.title} className="flex flex-col gap-1.5">
              <h2 className="m-0 text-base font-bold">{clause.title}</h2>
              <p className="m-0 text-[15px] leading-8 whitespace-pre-line text-text-2">
                {clause.text}
              </p>
            </div>
          ))}
        </div>

        <form
          noValidate
          onSubmit={submit}
          className="flex flex-col gap-5 p-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-7"
        >
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
            <span className="text-center text-[13px] leading-6 text-text-2">
              {t('sign.record')}
            </span>
          </div>
        </form>
      </Card>
    </>
  );
}
