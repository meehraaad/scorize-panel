import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { lockButtonOnHero } from '@/components/ui/Lock';
import { DateTile } from '@/components/ui/DateTile';
import { Icon } from '@/components/ui/Icon';
import { downloadIcs } from '@/lib/ics';
import type { Consultation } from '@/lib/applicant/consultations';
import { useFormat } from '@/lib/i18n/useFormat';

const MINUTE = 60_000;

/**
 * The next booked consultation, on the dark hero: when, with whom, how long until it (to the
 * minute), a button to put it in their calendar, and what to do before it. No files are needed
 * for a session; the consultant reads the tablet form and the session's topic.
 * Design: "Scorize New User Dashboard v2" canvas, UpcomingConsult.
 */
export function SessionCard({
  session,
  backgroundComplete,
}: {
  session: Consultation;
  backgroundComplete: boolean;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
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
      to: `/consultations/${String(session.id)}`,
    },
  ];

  return (
    <section
      aria-labelledby="journey-session"
      className="flex flex-wrap gap-x-8 gap-y-6 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:rounded-[32px] lg:px-11 lg:py-9"
    >
      <div className="flex min-w-0 flex-[1_1_320px] items-start gap-4">
        <DateTile value={session.starts_at} highlight large />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-hero-current">{t('session.kicker')}</span>
          <h2
            id="journey-session"
            className="m-0 font-display text-[22px] leading-snug font-bold lg:text-[26px]"
          >
            {session.title}
          </h2>
          <p className="m-0 text-sm leading-7 text-on-hero-2">
            {[
              t('session.when', {
                date: f.dateTime(session.starts_at),
                minutes: f.number(session.minutes),
              }),
              t(`session.mode.${session.mode}`),
              session.consultant && t('session.with', { name: session.consultant }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <Countdown startsAt={session.starts_at} />
          <div className="mt-2 flex flex-wrap gap-2 max-sm:[&>*]:flex-auto">
            <button
              type="button"
              className={buttonClass('primary')}
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
            <Link
              to={`/consultations/${String(session.id)}`}
              className={buttonClass('outline', lockButtonOnHero)}
            >
              {t('session.details')}
            </Link>
          </div>
          <span className="text-[13px] text-on-hero-2">{t('session.reminder')}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[20px] bg-hero-raised p-4 lg:p-5">
        <h3 className="m-0 text-base font-bold">{t('session.prep')}</h3>
        <p className="m-0 text-[13px] leading-6 text-on-hero-2">{t('session.prepHint')}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {prep.map((item) => (
            <li key={item.key} className="flex min-h-11 items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex size-6 flex-none items-center justify-center rounded-full ${
                  item.done ? 'bg-on-hero text-hero' : 'shadow-[inset_0_0_0_1.5px_var(--hero-line)]'
                }`}
              >
                {item.done && <Icon name="check" size={14} />}
              </span>
              <span className="min-w-0 flex-1 text-sm">{item.label}</span>
              <Link
                to={item.to}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-hero-current"
              >
                {t(item.done ? 'session.edit' : 'session.fill')}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Days, hours and minutes left, read again every minute. Gone once the session starts. */
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
      className="mt-2 flex gap-2"
    >
      {parts.map((part) => (
        <span
          key={part.key}
          aria-hidden="true"
          className="flex min-w-16 flex-col items-center rounded-2xl bg-hero-raised px-3 py-2"
        >
          <span className="font-display text-2xl leading-tight font-bold tabular-nums">
            {f.number(part.value)}
          </span>
          <span className="text-xs text-on-hero-2">{t(`session.left.${part.key}Unit`)}</span>
        </span>
      ))}
    </div>
  );
}
