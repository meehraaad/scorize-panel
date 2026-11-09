import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { FaceMark } from '@/components/customers/CustomerFace';
import { Icon } from '@/components/ui/Icon';
import type { Face } from '@/lib/face/api';
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
 * The call popup's header, the same in every step, on one row: who is on the line (a link to their
 * page), the call's state with the stage, how long, and a minimize button. Dark while the call is
 * live; light once it ends (with "not logged yet" while the form is still open). Without a `call`
 * (a log opened by hand) the state line says `label`; `titleLabel` then names the popup.
 * `face`: the customer's emoji and color (S66) in place of the first letter, when the team set one.
 * `children`: what we know about the customer, under the row (the brief and the profile chips).
 */
export function CallStrip({
  call,
  phone: phoneNumber,
  label,
  titleLabel,
  titleId,
  name,
  face,
  href,
  chips = [],
  notLogged = false,
  closeLabel,
  onClose,
  children,
}: {
  call?: ObservedCall | undefined;
  /** Without a call: the customer's number. */
  phone?: string | undefined;
  /** Without a call: what the popup is for, in place of the call's state. */
  label?: string | undefined;
  /** The popup's accessible name when it isn't just the customer's name. */
  titleLabel?: string | undefined;
  titleId: string;
  name?: string | undefined;
  face?: Face | null | undefined;
  href?: string | undefined;
  /** Short facts after the state (stage, score). */
  chips?: readonly string[];
  notLogged?: boolean;
  closeLabel: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const now = useNow();
  const over = !!call && call.ended_at !== null;
  const live = !!call && !over && call.status in LABEL;
  const number = f.digits(call?.phone ?? phoneNumber ?? '');
  const muted = over ? 'text-text-2' : 'text-on-hero-2';
  const title: ReactNode = !name ? (
    <span dir="ltr" className="tabular-nums">
      {number}
    </span>
  ) : href ? (
    <Link
      to={href}
      className="inline-flex max-w-full items-center gap-1 text-inherit no-underline hover:underline"
    >
      <span className="truncate">{name}</span>
      <Icon name="chevronEnd" size={16} className="flex-none" />
    </Link>
  ) : (
    name
  );
  const facts = [
    ...(call ? [t(`phoneCall.direction.${call.direction}`)] : name && number ? [number] : []),
    ...(name ? [] : [t('callStrip.unknownNumber')]),
    ...chips,
  ];
  return (
    <div
      className={`flex flex-col gap-3 px-5 pt-3.5 pb-4 ${over ? 'bg-board text-text' : 'bg-hero text-on-hero'}`}
    >
      <div className="flex items-center gap-3">
        {name &&
          (face ? (
            <FaceMark
              name={name}
              face={face}
              className="size-10 rounded-full"
              plain={over ? 'bg-surface text-text-2' : 'bg-hero-accent text-hero'}
            />
          ) : (
            <span
              aria-hidden="true"
              className={`inline-flex size-10 flex-none items-center justify-center rounded-full font-bold ${over ? 'bg-surface text-text-2' : 'bg-hero-accent text-hero'}`}
            >
              {initialOf(name)}
            </span>
          ))}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            id={titleId}
            aria-label={titleLabel}
            className="m-0 truncate font-display text-[17px] font-bold"
          >
            {title}
          </h2>
          <p
            role={call ? 'status' : undefined}
            className={`m-0 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs ${muted}`}
          >
            {call ? (
              <>
                <span
                  aria-hidden="true"
                  className={`size-2 flex-none rounded-full ${DOT[call.status]}`}
                />
                <span
                  className={`font-semibold ${live ? LABEL[call.status as keyof typeof LABEL] : over ? 'text-text' : ''}`}
                >
                  {t(`phoneCall.status.${call.status}`)}
                </span>
              </>
            ) : (
              <span className="font-semibold">{label}</span>
            )}
            {facts.map((fact) => (
              <span key={fact}>· {fact}</span>
            ))}
            {notLogged && over && (
              <span className="rounded-full bg-warn-tint px-2 font-semibold text-warn">
                {t('callStrip.notLogged')}
              </span>
            )}
          </p>
        </div>
        {call && (
          <span
            dir="ltr"
            aria-label={t('phoneCall.duration')}
            className={`flex-none font-mono text-lg tabular-nums ${over ? 'text-text-2' : live ? LABEL[call.status as keyof typeof LABEL] : ''}`}
          >
            {f.digits(callDuration(callSeconds(call, now)))}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={`inline-flex size-11 flex-none items-center justify-center rounded-xl ${over ? 'text-text-2 hover:bg-surface' : 'bg-hero-raised text-on-hero hover:bg-hero-line'}`}
        >
          <Icon name="chevronDown" />
        </button>
      </div>
      {call && !call.connected && !over && (
        <p className="m-0 text-[13px] leading-6 text-on-hero-2">{t('phoneCall.disconnected')}</p>
      )}
      {children}
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
