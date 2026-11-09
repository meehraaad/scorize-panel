import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { callDuration, callSeconds, type ObservedCall } from '@/lib/sales/phoneCalls';
import { initialOf } from '@/lib/text';
import { useNow } from '../useNow';

/** The status dot's color: amber while it rings, green in a call, grey once it is over. */
const DOT = {
  ringing: 'bg-hero-current',
  connected: 'bg-live',
  ended: 'bg-text-3',
  missed: 'bg-danger',
  cancelled: 'bg-text-3',
} as const;
const LABEL = {
  ringing: 'text-hero-current',
  connected: 'text-live',
} as const;

/**
 * The call popup's header, the same in every step: who is on the line, how long, and a minimize
 * button. Dark while the call is live; light once it ends (with "not logged yet" while the form is
 * still open). `name`: the customer (a link to their page); without it the number is the title.
 */
export function CallStrip({
  call,
  titleId,
  name,
  href,
  chips = [],
  notLogged = false,
  closeLabel,
  onClose,
}: {
  call: ObservedCall;
  titleId: string;
  name?: string | undefined;
  href?: string | undefined;
  chips?: readonly string[];
  notLogged?: boolean;
  closeLabel: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const now = useNow();
  const over = call.ended_at !== null;
  const live = !over && call.status in LABEL;
  const phone = (
    <span dir="ltr" className="font-medium tabular-nums">
      {f.digits(call.phone)}
    </span>
  );
  const title: ReactNode = name ? (
    href ? (
      <Link
        to={href}
        className="inline-flex items-center gap-1 text-inherit no-underline hover:underline"
      >
        {name}
        <Icon name="chevronEnd" size={16} />
      </Link>
    ) : (
      name
    )
  ) : (
    phone
  );
  return (
    <div
      className={`flex flex-col gap-3 px-5 pt-4 pb-5 ${over ? 'bg-board text-text' : 'bg-hero text-on-hero'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          role="status"
          className={`m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] ${over ? 'text-text-2' : 'text-on-hero-2'}`}
        >
          <span
            aria-hidden="true"
            className={`size-2.5 flex-none rounded-full ${DOT[call.status]}`}
          />
          <span
            className={`font-semibold ${live ? LABEL[call.status as keyof typeof LABEL] : over ? 'text-text' : ''}`}
          >
            {t(`phoneCall.status.${call.status}`)}
          </span>
          <span>
            {t(`phoneCall.direction.${call.direction}`)}
            {' · '}
            {t('phoneCall.extension', { extension: f.digits(call.extension) })}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={`inline-flex size-11 flex-none items-center justify-center rounded-xl ${over ? 'text-text-2 hover:bg-surface' : 'bg-hero-raised text-on-hero hover:bg-hero-line'}`}
        >
          <Icon name="chevronDown" />
        </button>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {name && (
            <span
              aria-hidden="true"
              className={`inline-flex size-11 flex-none items-center justify-center rounded-full text-lg font-bold ${over ? 'bg-surface text-text-2' : 'bg-hero-accent text-hero'}`}
            >
              {initialOf(name)}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            {!name && (
              <span className={`text-[13px] ${over ? 'text-text-2' : 'text-on-hero-2'}`}>
                {t('callStrip.unknownNumber')}
              </span>
            )}
            <h2 id={titleId} className="m-0 font-display text-lg font-bold">
              {title}
            </h2>
            {name && (
              <div
                className={`flex flex-wrap items-center gap-1.5 text-xs ${over ? 'text-text-2' : 'text-on-hero-2'}`}
              >
                {phone}
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className={`rounded-full px-2.5 py-0.5 ${over ? 'bg-surface' : 'bg-hero-raised'}`}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          {notLogged && over && (
            <span className="rounded-full bg-warn-tint px-2.5 py-0.5 text-xs font-semibold text-warn">
              {t('callStrip.notLogged')}
            </span>
          )}
          <span
            dir="ltr"
            aria-label={t('phoneCall.duration')}
            className={`font-mono text-xl tabular-nums ${over ? 'text-text-2' : live ? LABEL[call.status as keyof typeof LABEL] : ''}`}
          >
            {f.digits(callDuration(callSeconds(call, now)))}
          </span>
        </div>
      </div>
      {!call.connected && !over && (
        <p className="m-0 text-[13px] leading-6 text-on-hero-2">{t('phoneCall.disconnected')}</p>
      )}
    </div>
  );
}

/** The two steps of an unknown caller's popup: who it is, then the log. */
export function CallSteps({ step, done }: { step: 1 | 2; done?: string | undefined }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const item = (number: 1 | 2, label: string) => {
    const current = number === step;
    const finished = number < step;
    return (
      <li
        aria-current={current ? 'step' : undefined}
        className={`flex items-center gap-2 ${current ? 'font-semibold text-primary-text' : 'text-text-2'}`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-6 flex-none items-center justify-center rounded-full text-xs ${
            current
              ? 'bg-primary text-on-primary'
              : finished
                ? 'bg-good-tint text-good'
                : 'bg-track'
          }`}
        >
          {finished ? <Icon name="check" size={14} /> : f.number(number)}
        </span>
        {label}
      </li>
    );
  };
  return (
    <ol className="m-0 -mt-1 flex list-none items-center gap-2 p-0 text-[13px]">
      {item(1, step > 1 && done ? done : t('callStrip.stepWho'))}
      <li
        aria-hidden="true"
        className={`h-0.5 flex-1 rounded ${step > 1 ? 'bg-primary' : 'bg-track'}`}
      />
      {item(2, t('callStrip.stepLog'))}
    </ol>
  );
}
