import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { lockButtonOnHero } from '@/components/ui/Lock';
import { DateTile } from '@/components/ui/DateTile';
import { Icon } from '@/components/ui/Icon';
import type { Consultation } from '@/lib/applicant/consultations';
import { useFormat } from '@/lib/i18n/useFormat';

/**
 * The next booked consultation, on the dark hero: when, with whom, and what to do before it. No
 * files are needed for a session; the consultant reads the tablet form and the session's topic.
 * Design: "Scorize New User Dashboard" canvas, upcoming consultation.
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
          <Link
            to={`/consultations/${String(session.id)}`}
            className={buttonClass('outline', `mt-2 self-start ${lockButtonOnHero}`)}
          >
            {t('session.details')}
          </Link>
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
