import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import { consultationsQuery, splitSessions, type Consultation } from './api';
import { SessionSummariesCard } from './SessionSummariesCard';
import { DateTile } from '@/components/ui/DateTile';

type Filter = 'all' | 'upcoming' | 'past';

/**
 * Booked consultations: the next session (with a nudge to fill in its details) and every booking.
 * Design: canvas V6 section 15 (AppConsult).
 */
export default function ConsultationsPage() {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const { data } = useSuspenseQuery(consultationsQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const { upcoming, past } = splitSessions(data.results);
  const next = upcoming[0];
  const shown =
    filter === 'upcoming' ? upcoming : filter === 'past' ? past : [...upcoming, ...past];

  return (
    <PageStack>
      <BackLink to="/services">{t('back')}</BackLink>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <a href={SITE.consultation} className={buttonClass('primary', 'max-sm:w-full')}>
            {t('book')}
          </a>
        }
      />

      <SessionSummariesCard />

      {next && <NextSession session={next} />}

      <SectionCard
        id="consultations-all"
        title={t('all.title')}
        end={
          data.results.length > 0 && (
            <FilterTabs
              label={t('all.filter')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('all.all'), count: f.number(data.results.length) },
                { value: 'upcoming', label: t('all.upcoming'), count: f.number(upcoming.length) },
                { value: 'past', label: t('all.past'), count: f.number(past.length) },
              ]}
            />
          )
        }
      >
        {shown.length === 0 ? (
          <EmptyState>{t(data.results.length ? 'all.emptyFilter' : 'all.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {shown.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                upcoming={upcoming.includes(session)}
              />
            ))}
          </ul>
        )}
        {data.results.length > 0 && (
          <p className="m-0 px-5 py-4 text-sm text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
            {t('all.count', { n: f.number(shown.length) })}
          </p>
        )}
      </SectionCard>
    </PageStack>
  );
}

function NextSession({ session }: { session: Consultation }) {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const days = daysUntil(session.starts_at);
  const facts = [
    t('time', { time: f.time(session.starts_at) }),
    t('minutes', { n: f.number(session.minutes) }),
    t(`mode.${session.mode}`),
    session.consultant && t('consultant', { name: session.consultant }),
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="consultations-next"
      className="flex flex-wrap items-center gap-6 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:rounded-[28px] lg:px-8 lg:py-7"
    >
      <DateTile value={session.starts_at} highlight large />
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-hero-current">
          {days === 0 ? t('next.today') : t('next.in', { days: f.relativeDays(days) })}
        </span>
        <h2
          id="consultations-next"
          className="m-0 font-display text-[22px] font-bold lg:text-[26px]"
        >
          {session.title}
        </h2>
        <span className="text-sm text-on-hero-2">{facts.join(' · ')}</span>
        <span className="text-[13px] text-on-hero-2">{t('next.reminder')}</span>
      </div>
      <div className="flex flex-col items-stretch gap-2 max-sm:w-full sm:items-end">
        <span
          className={`inline-flex items-center gap-2 text-sm ${session.info_complete ? 'text-live' : 'text-hero-current'}`}
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          {t(session.info_complete ? 'next.complete' : 'next.incomplete')}
        </span>
        <Link to={`/consultations/${String(session.id)}`} className={buttonClass('primary')}>
          {t(session.info_complete ? 'next.edit' : 'next.fill')}
        </Link>
      </div>
    </section>
  );
}

function SessionRow({ session, upcoming }: { session: Consultation; upcoming: boolean }) {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const when = [
    f.weekday(session.starts_at),
    t('time', { time: f.time(session.starts_at) }),
    session.consultant && t('consultant', { name: session.consultant }),
  ].filter(Boolean);
  return (
    <li
      className={`flex flex-wrap items-center gap-4 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 ${
        upcoming ? '' : 'text-text-2'
      }`}
    >
      <DateTile value={session.starts_at} highlight={upcoming} />
      <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-text">{session.title}</span>
          <Chip tone="neutral" small>
            {t(`mode.${session.mode}`)}
          </Chip>
        </span>
        <span className="text-[13px]">{when.join(' · ')}</span>
        {session.summary && <span className="text-[13px] leading-6">{session.summary}</span>}
      </span>
      <Link
        to={`/consultations/${String(session.id)}`}
        className={buttonClass('outline', 'max-sm:w-full')}
      >
        {t(upcoming ? 'all.info' : 'all.details')}
      </Link>
    </li>
  );
}
