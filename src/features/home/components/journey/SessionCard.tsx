import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { sessionHref } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import type { Consultation } from '@/lib/applicant/consultations';
import { daysUntil } from '@/lib/dates';
import { downloadIcs } from '@/lib/ics';
import { useFormat } from '@/lib/i18n/useFormat';

const MINUTE = 60_000;

/**
 * The next booked consultation on the luxe card: when, with whom, how long until it, a button to
 * put it in their calendar, its details and invoice (a sheet over the home), and what to do before
 * it. Phones get the short card: the date tile and what is still to do, no countdown or done steps.
 * Design: "مشاوره در صفحه اصلی پنل" canvas, booked (desktop and mobile).
 */
export function SessionCard({
  session,
  backgroundComplete,
  access,
}: {
  session: Consultation;
  backgroundComplete: boolean;
  access: ApplicantAccess;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const days = daysUntil(session.starts_at);
  const { day, month } = f.dayMonth(session.starts_at);
  const details = sessionHref(session.id);
  const prep = [
    {
      key: 'background',
      done: backgroundComplete,
      label: t(backgroundComplete ? 'session.backgroundDone' : 'session.background'),
      to: '/background',
    },
    {
      key: 'info',
      done: session.info_complete,
      label: t(session.info_complete ? 'session.infoDone' : 'session.info'),
      to: details,
    },
  ];
  const left = prep.filter((item) => !item.done).length;

  return (
    <section
      aria-labelledby="journey-session"
      className="flex flex-col gap-4 rounded-[24px] p-5 text-on-hero shadow-luxe bg-luxe lg:flex-row lg:gap-8 lg:rounded-[28px] lg:px-11 lg:py-10"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:contents lg:gap-3">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="w-15 flex-none overflow-hidden rounded-xl bg-hero-raised text-center shadow-luxe lg:hidden"
          >
            <span className="block py-0.5 text-[11px] font-bold bg-luxe-gold">{month}</span>
            <span className="block pt-0.5 pb-1.5 font-display text-2xl leading-snug font-bold">
              {day}
            </span>
          </span>
          <div className="flex min-w-0 flex-col gap-0.5 lg:gap-3">
            <span className="text-xs font-semibold text-luxe-gold-light lg:text-[13px]">
              <span id="journey-session">{session.title}</span>
              <span className="lg:hidden">
                {' · '}
                {days === 0 ? t('session.today') : f.relativeDays(days)}
              </span>
            </span>
            <h2 className="m-0 font-display text-[17px] leading-[1.7] font-semibold lg:text-3xl">
              {t('session.at', {
                date: f.weekday(session.starts_at),
                time: f.time(session.starts_at),
              })}
            </h2>
            <p className="m-0 text-xs leading-6 text-on-luxe-2 lg:text-[15px] lg:leading-8">
              {[
                t('session.minutes', { n: f.number(session.minutes) }),
                t(`session.mode.${session.mode}`),
                session.consultant && t('session.with', { name: session.consultant }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <Countdown startsAt={session.starts_at} />
        <div className="mt-auto grid grid-cols-2 gap-2 max-lg:order-last lg:flex lg:flex-wrap lg:pt-5">
          <button
            type="button"
            className={buttonClass('gold', 'h-12')}
            onClick={() =>
              downloadIcs(
                {
                  uid: `consultation-${String(session.id)}@scorize`,
                  title: session.title,
                  starts_at: session.starts_at,
                  minutes: session.minutes,
                  ...(session.consultant && {
                    description: t('session.with', { name: session.consultant }),
                  }),
                },
                `scorize-consultation-${String(session.id)}.ics`,
              )
            }
          >
            <Icon name="calendar" size={18} />
            {t('session.calendar')}
          </button>
          <Link to={details} className={buttonClass('onLuxe', 'h-12')}>
            {t('session.details')}
          </Link>
        </div>
        <span className="text-[13px] text-on-luxe-2 max-lg:hidden">{t('session.reminder')}</span>
      </div>

      <div
        className={`flex flex-col rounded-xl bg-hero-raised px-3.5 lg:w-90 lg:flex-none lg:gap-3.5 lg:rounded-[24px] lg:p-6 ${left ? '' : 'max-lg:hidden'}`}
      >
        <div className="flex items-baseline justify-between gap-3 max-lg:hidden">
          <h3 className="m-0 text-[17px] font-bold">{t('session.prep')}</h3>
          <span className="text-[13px] font-semibold text-luxe-gold-light">
            {t('session.prepDone', {
              done: f.number(prep.length - left),
              all: f.number(prep.length),
            })}
          </span>
        </div>
        <p className="m-0 text-[13px] leading-6 text-on-luxe-2 max-lg:hidden">
          {t('session.prepHint')}
        </p>
        <ul className="m-0 flex list-none flex-col p-0">
          {prep.map((item) => (
            <li
              key={item.key}
              className={`flex min-h-12 items-center gap-3 shadow-[inset_0_1px_0_var(--hero-line)] ${item.done ? 'max-lg:hidden' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`flex size-6 flex-none items-center justify-center rounded-full ${
                  item.done ? 'bg-luxe-gold' : 'shadow-[inset_0_0_0_1.5px_var(--hero-line)]'
                }`}
              >
                {item.done && <Icon name="check" size={14} />}
              </span>
              <span
                className={`min-w-0 flex-1 text-sm ${item.done ? 'text-on-luxe-2' : 'font-semibold'}`}
              >
                {item.label}
              </span>
              <Link
                to={item.to}
                className={`inline-flex min-h-11 items-center text-sm font-bold ${item.done ? 'text-on-luxe-2' : 'text-luxe-gold-light'}`}
              >
                {t(item.done ? 'session.edit' : 'session.fill')}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2.5 pt-3.5 shadow-[inset_0_1px_0_var(--hero-line)] max-lg:hidden">
          <span className="text-[13px] text-on-luxe-2">{t('session.reschedule')}</span>
          <CallRequestButton
            label={t('session.rescheduleCall')}
            className="inline-flex min-h-11 items-center text-[13px] font-semibold underline underline-offset-4"
            phone={access.phone}
            topic="admission"
            page="home"
            reason="guest"
          />
        </div>
      </div>
    </section>
  );
}

/** Days, hours and minutes left (from lg up), read again every minute. Gone once it starts. */
function Countdown({ startsAt }: { startsAt: string }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  const left = Math.floor((new Date(startsAt).getTime() - now) / MINUTE);
  if (left <= 0) return null;
  const parts = [
    { key: 'days', value: Math.floor(left / (24 * 60)) },
    { key: 'hours', value: Math.floor(left / 60) % 24 },
    { key: 'minutes', value: left % 60 },
  ] as const;
  const spoken = parts.map((part) => t(`session.left.${part.key}`, { n: f.number(part.value) }));

  return (
    <div
      role="timer"
      aria-label={t('session.left.label', { left: f.list(spoken) })}
      className="mt-2 flex items-center gap-5 max-lg:hidden"
    >
      {parts.map((part, index) => (
        <span key={part.key} aria-hidden="true" className="flex items-center gap-5">
          {index > 0 && <span className="h-9 w-px bg-hero-line" />}
          <span className="flex items-baseline gap-2">
            <span className="font-display text-[40px] leading-tight font-semibold text-luxe-gold-light tabular-nums">
              {f.number(part.value)}
            </span>
            <span className="text-sm text-on-luxe-2">{t(`session.left.${part.key}Unit`)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
