import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { PersonLink } from '../components/PersonLink';
import { Trend } from '../components/TaskStatus';
import { shareTone, useShare } from '../components/share';
import { dayOf } from '../format';
import { teamsPath } from '../paths';
import { STATE_TONE, teamQuery, type TeamMember } from './api';

type Filter = 'all' | 'attention';

/** Someone needs a look: an overdue task, or under 70% on time. */
const needsLook = (member: TeamMember) =>
  member.tasks.overdue > 0 || (member.tasks.on_time !== null && member.tasks.on_time < 0.7);

/**
 * One team (canvas "وضعیت تیم‌ها", board 3): its numbers, each person's own tasks (open, overdue
 * and the oldest one's age, this month's done and on-time share), the on-time share month by
 * month, the team's oldest overdue tasks by name, and contract ends, trials and birthdays ahead.
 */
export default function TeamPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const share = useShare();
  const team = useParams().team ?? '';
  const { data } = useSuspenseQuery(teamQuery(team));
  const [filter, setFilter] = useState<Filter>('all');
  const n = (value: number) => f.number(value);
  const name = t(`team.${data.team}`);
  const { tasks } = data;
  const rows = data.people.filter((member) => filter === 'all' || needsLook(member));

  const main = (
    <Card aria-label={t('teams.peopleTitle')} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 lg:px-6">
        <h2 className="m-0 text-section font-bold">{t('teams.peopleTitle')}</h2>
        <FilterTabs
          label={t('teams.filter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('teams.filters.all'), count: n(data.people.length) },
            {
              value: 'attention',
              label: t('teams.filters.notGood'),
              count: n(data.people.filter(needsLook).length),
            },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState variant="padded">{t('teams.nobody')}</EmptyState>
      ) : (
        <ul aria-label={t('teams.peopleTitle')} className="m-0 list-none p-0 pt-3 pb-2">
          {rows.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
      <p className="m-0 border-t border-hair px-5 py-3 text-xs leading-5 text-text-2 lg:px-6">
        {t('teams.onTimeHint')}
      </p>
    </Card>
  );

  const highest = Math.max(...data.months.map((month) => month.on_time ?? 0), 0.01);
  const aside = (
    <PageStack>
      <SectionCard id="hr-team-months" title={t('teams.months')} variant="panel">
        <ul aria-label={t('teams.months')} className="m-0 flex h-40 list-none items-end gap-3 p-0">
          {data.months.map((month, index) => (
            <li
              key={month.first}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-xs font-bold tabular-nums">{share(month.on_time)}</span>
              <span
                aria-hidden="true"
                className={`w-full rounded-t-lg rounded-b ${index === 0 ? 'bg-primary' : 'bg-tint'}`}
                style={{ height: `${String(((month.on_time ?? 0) / highest) * 70 + 4)}%` }}
              />
              <span className="text-xs text-text-2">{f.month(dayOf(month.first))}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard id="hr-team-overdue" title={t('teams.overdueTasks')} variant="panel">
        {data.overdue_tasks.length === 0 ? (
          <EmptyState variant="inset">{t('teams.noOverdue')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.overdue_tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start justify-between gap-3 border-t border-hair py-2.5 first:border-t-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 text-sm">{task.text}</span>
                  {task.owner && <span className="text-xs text-text-2">{task.owner.name}</span>}
                </span>
                <span
                  className={`text-sm font-bold whitespace-nowrap ${task.days >= 7 ? 'text-danger' : 'text-warn'}`}
                >
                  {t('teams.daysLate', { n: n(task.days) })}
                </span>
              </li>
            ))}
            {data.overdue_count > data.overdue_tasks.length && (
              <li className="border-t border-hair pt-2.5 text-xs text-text-2">
                {t('teams.moreOverdue', { n: n(data.overdue_count - data.overdue_tasks.length) })}
              </li>
            )}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="hr-team-coming" title={t('teams.coming')} variant="panel">
        {data.coming.length === 0 ? (
          <EmptyState variant="inset">{t('teams.nothingComing')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {data.coming.map((event) => (
              <li key={`${event.kind}-${String(event.staff.id)}`} className="text-sm leading-7">
                {t(`teams.event.${event.kind}`, {
                  name: event.staff.name,
                  day: f.dateShort(dayOf(event.day)),
                })}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageStack>
  );

  return (
    <PageStack>
      <BackLink to={teamsPath}>{t('teams.back')}</BackLink>
      <PageHeader
        title={t('teams.name', { team: name })}
        subtitle={[
          data.manager ? t('teams.manager', { name: data.manager.name }) : t('teams.noManager'),
          t('teams.people', { n: n(data.people.length) }),
        ].join(' · ')}
        actions={
          <Chip tone={STATE_TONE[data.state]} dot>
            {t(`teams.state.${data.state}`)}
          </Chip>
        }
      />
      <StatGrid
        label={t('teams.numbers')}
        compact
        stats={[
          {
            label: t('teams.open'),
            value: n(tasks.open),
            note: t('teams.dueToday', { n: n(tasks.today) }),
          },
          {
            label: t('teams.overdue'),
            value: n(tasks.overdue),
            tone: tasks.overdue ? 'urgent' : 'good',
            ...(tasks.oldest_days !== null && {
              note: t('teams.oldest', { n: n(tasks.oldest_days) }),
            }),
          },
          {
            label: t('teams.onTime'),
            value: share(tasks.on_time),
            ...(tasks.on_time_before !== null && {
              note: t('teams.before', { value: share(tasks.on_time_before) }),
            }),
          },
          {
            label: t('teams.doneMonth'),
            value: n(tasks.done),
            note: t('tasks.doneSplit', {
              onTime: n(tasks.done_on_time),
              late: n(tasks.done - tasks.done_on_time),
            }),
          },
        ]}
      />
      <PageColumns main={main} aside={aside} asideLabel={t('teams.aside')} />
    </PageStack>
  );
}

function MemberRow({ member }: { member: TeamMember }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const share = useShare();
  const { tasks } = member;
  const n = (value: number) => f.number(value);
  const chip =
    tasks.overdue > 2
      ? { tone: 'danger' as const, text: t('teams.chip.overdue', { n: n(tasks.overdue) }) }
      : member.contract_end
        ? {
            tone: 'warn' as const,
            text: t(member.trial ? 'teams.chip.trial' : 'teams.chip.contract', {
              day: f.dateShort(dayOf(member.contract_end)),
            }),
          }
        : member.state === 'joining' || member.state === 'leaving'
          ? { tone: 'neutral' as const, text: t(`state.${member.state}`) }
          : null;
  const figures = [
    { key: 'open' as const, value: n(tasks.open), tone: '' },
    {
      key: 'overdue' as const,
      value: n(tasks.overdue),
      tone: tasks.overdue > 2 ? 'text-danger' : tasks.overdue ? 'text-warn' : 'text-good',
    },
    {
      key: 'oldest' as const,
      value:
        tasks.oldest_days === null ? t('tasks.none') : t('teams.days', { n: n(tasks.oldest_days) }),
      tone: 'text-text-2',
    },
    { key: 'done' as const, value: n(tasks.done), tone: '' },
  ];
  return (
    <li
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hair px-5 py-3 first:border-t-0 lg:px-6 ${needsLook(member) ? 'bg-row-highlight' : ''}`}
    >
      <div className="min-w-0 flex-[1_1_200px]">
        <PersonLink
          id={member.id}
          name={member.name}
          face={member.face}
          sub={member.position ?? undefined}
        />
      </div>
      <dl className="m-0 flex flex-[2_1_360px] flex-wrap items-center gap-x-5 gap-y-1">
        {figures.map((figure) => (
          <div key={figure.key} className="flex min-w-14 flex-col">
            <dt className="text-xs text-text-2">{t(`teams.member.${figure.key}`)}</dt>
            <dd className={`m-0 text-sm font-bold tabular-nums ${figure.tone}`}>{figure.value}</dd>
          </div>
        ))}
        <div className="flex min-w-24 flex-col">
          <dt className="text-xs text-text-2">{t('teams.member.onTime')}</dt>
          <dd className="m-0 flex items-baseline gap-1.5">
            <span className={`text-sm font-bold tabular-nums ${shareTone(tasks.on_time)}`}>
              {share(tasks.on_time)}
            </span>
            <Trend now={tasks.on_time} before={tasks.on_time_before} />
          </dd>
        </div>
      </dl>
      {chip && (
        <Chip tone={chip.tone} small>
          {chip.text}
        </Chip>
      )}
    </li>
  );
}
