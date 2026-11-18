import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { taskListQuery, tasksQuery } from '@/lib/tasks/api';
import { todayQuery, type AttendanceDay } from './api';
import { STATUS_TONE, clockOf } from './format';
import { marketingPath } from './paths';

/** How many of today's tasks the page lists; the rest are a link away. */
export const TODAY_TASKS = 5;

/**
 * The marketing team's day (canvas "Scorize Marketing Panel", امروز): my tasks for today, the
 * campaigns running now, my attendance and the team's from the office terminal. The board's
 * cards join in phase 2.
 */
export default function TodayPage() {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const [now] = useState(() => Date.now());
  const { data } = useSuspenseQuery(todayQuery);
  const { data: overview } = useSuspenseQuery(tasksQuery('marketing'));
  const { data: mine } = useSuspenseQuery(taskListQuery('marketing', 'mine', 1));
  const n = (value: number) => f.number(value);
  const onTime = overview.on_time?.week;

  const main = (
    <PageStack>
      <SectionCard
        id="marketing-tasks"
        title={t('today.tasks')}
        end={
          <Link to={marketingPath('tasks')} className="text-sm font-semibold text-primary-text">
            {t('today.allTasks')}
          </Link>
        }
      >
        {mine.results.length === 0 ? (
          <EmptyState variant="inset">{t('today.noTasks')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0 pb-3">
            {mine.results.slice(0, TODAY_TASKS).map((task) => {
              const late = new Date(task.due_at).getTime() < now;
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-3 first:border-t-0 lg:px-8"
                >
                  <span className="min-w-0 flex-1 text-[15px] font-semibold">{task.text}</span>
                  {late ? (
                    <Chip tone="danger" small>
                      {t('today.overdue')}
                    </Chip>
                  ) : (
                    <Chip tone="neutral" small>
                      {task.timed === false ? t('today.allDay') : f.time(task.due_at)}
                    </Chip>
                  )}
                </li>
              );
            })}
            {mine.count > TODAY_TASKS && (
              <li className="px-5 pt-2 lg:px-8">
                <Link
                  to={marketingPath('tasks')}
                  className="text-sm font-semibold text-primary-text"
                >
                  {t('today.moreTasks', { n: n(mine.count - TODAY_TASKS) })}
                </Link>
              </li>
            )}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="marketing-campaigns" title={t('today.campaigns')}>
        {data.campaigns.length === 0 ? (
          <EmptyState variant="inset">{t('today.noCampaigns')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0 pb-3">
            {data.campaigns.map((campaign) => (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-3 first:border-t-0 lg:px-8"
              >
                <span className="min-w-0 flex-1 text-[15px] font-semibold">{campaign.title}</span>
                <span className="text-sm text-text-2">
                  {campaign.end
                    ? t('today.campaignEnds', { day: f.dateShort(campaign.end) })
                    : t('today.campaignOpen')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageStack>
  );

  const aside = (
    <PageStack>
      <MyDay day={data.me} />
      <SectionCard id="marketing-team" title={t('today.team')} variant="panel">
        {data.team.length === 0 ? (
          <EmptyState variant="inset">{t('today.noTeam')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {data.team.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {member.me ? `${member.name} · ${t('today.you')}` : member.name}
                </span>
                <AttendanceChip day={member.attendance} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageStack>
  );

  return (
    <PageStack>
      <PageHeader title={t('today.title')} subtitle={t('today.subtitle')} />
      <StatGrid
        label={t('today.counts')}
        stats={[
          { label: t('today.mine'), value: n(overview.counts.mine), tone: 'primary' },
          { label: t('today.requests'), value: n(overview.counts.requests) },
          { label: t('today.doneToday'), value: n(overview.done_today ?? 0), tone: 'good' },
          {
            label: t('today.onTime'),
            value: onTime == null ? '—' : t('percent', { n: n(Math.round(onTime * 100)) }),
          },
        ]}
      />
      <PageColumns main={main} aside={aside} asideLabel={t('today.aside')} />
    </PageStack>
  );
}

/** A teammate's day in one chip: in at what time, late by how much, absent, or not in yet. */
function AttendanceChip({ day }: { day: AttendanceDay | null }) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  if (!day)
    return (
      <Chip tone="neutral" small>
        {t('noDevice')}
      </Chip>
    );
  const label =
    day.status === 'late'
      ? t('today.lateBy', { time: f.digits(clockOf(day.late_seconds)) })
      : day.status === 'present' && day.check_in
        ? t('today.inAt', { time: f.time(day.check_in) })
        : t(`status.${day.status}`);
  return (
    <Chip tone={STATUS_TONE[day.status]} small>
      {label}
    </Chip>
  );
}

function MyDay({ day }: { day: AttendanceDay | null }) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  return (
    <Card aria-labelledby="marketing-me" className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="marketing-me" className="m-0 text-base font-bold">
          {t('today.me')}
        </h2>
        {day && (
          <Chip tone={STATUS_TONE[day.status]} small>
            {t(`status.${day.status}`)}
          </Chip>
        )}
      </div>
      {day ? (
        <dl className="m-0 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
            <dt className="text-xs text-text-2">{t('today.checkIn')}</dt>
            <dd className="m-0 text-lg font-bold">
              {day.check_in ? f.time(day.check_in) : t('today.notYet')}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
            <dt className="text-xs text-text-2">{t('today.checkOut')}</dt>
            <dd className="m-0 text-lg font-bold">
              {day.check_out ? f.time(day.check_out) : t('today.notYet')}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="m-0 text-sm leading-7 text-text-2">{t('today.meNoDevice')}</p>
      )}
    </Card>
  );
}
