import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { healthQuery, useManageTask, type HealthData, type HealthTeam } from '../api';
import { useSalesFormat } from '../format';

const TEAMS = ['all', 'sales', 'supervisors'] as const satisfies readonly HealthTeam[];
const PEOPLE_COLUMNS = [
  'person',
  'role',
  'onTime',
  'overdue',
  'orphans',
  'snoozed',
  'oldest',
] as const;
/** Below this share on time, a person is flagged. */
const LOW_ON_TIME = 0.7;

/**
 * How well each person keeps up with follow-ups, instead of a penalty per task: on-time share,
 * overdue, people without a next step. Canvas "سلامت پیگیری تیم".
 */
export default function FollowUpHealthPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [team, setTeam] = useState<HealthTeam>('all');
  const { data } = useQuery(healthQuery(team));

  return (
    <>
      <PageHeader
        title={
          data
            ? t('manager.health.title', { n: f.number(data.orphans.value) })
            : t('manager.section.followUps')
        }
        subtitle={t('manager.health.subtitle')}
        actions={
          <SelectField
            inline
            label={t('manager.health.team')}
            value={team}
            onChange={setTeam}
            options={TEAMS.map((value) => ({
              value,
              label: t(`manager.health.teamOption.${value}`),
            }))}
          />
        }
      />
      {!data ? <SkeletonRows rows={6} /> : <Health data={data} />}
    </>
  );
}

function Health({ data }: { data: HealthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const kpis = [
    {
      key: 'onTime',
      value: s.percent(data.on_time.value),
      note: t('manager.health.onTimeNote', { n: s.percent(data.on_time.target) }),
      weeks: data.on_time.weeks.map((week) => s.percent(week)),
      shares: data.on_time.weeks,
      good: true,
    },
    {
      key: 'overdue',
      value: f.number(data.overdue.value),
      note: t('manager.health.overdueNote', { n: f.number(data.overdue.over_two_days) }),
      weeks: data.overdue.weeks.map((week) => f.number(week)),
      shares: data.overdue.weeks.map((week) => week / Math.max(1, ...data.overdue.weeks)),
      good: false,
    },
    {
      key: 'orphans',
      value: f.number(data.orphans.value),
      note: t('manager.health.orphansNote', {
        customers: f.number(data.orphans.customers),
        files: f.number(data.orphans.files),
      }),
      weeks: data.orphans.weeks.map((week) => f.number(week)),
      shares: data.orphans.weeks.map((week) => week / Math.max(1, ...data.orphans.weeks)),
      good: false,
    },
    {
      key: 'automatic',
      value: s.percent(data.automatic.value),
      note: t('manager.health.automaticNote'),
      weeks: data.automatic.weeks.map((week) => s.percent(week)),
      shares: data.automatic.weeks,
      good: true,
    },
  ] as const;

  return (
    <>
      <ul
        aria-label={t('manager.health.kpis')}
        className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <li key={kpi.key}>
            <Card className="flex h-full flex-col gap-2 p-5">
              <span className="text-sm text-text-2">{t(`manager.health.kpi.${kpi.key}`)}</span>
              <span className="text-2xl font-bold tabular-nums">{kpi.value}</span>
              <span className="text-xs text-text-2">{kpi.note}</span>
              <span
                role="img"
                aria-label={t('manager.health.trend', { list: f.list(kpi.weeks) })}
                className="mt-auto flex h-8 items-end gap-1"
              >
                {kpi.shares.map((share, index) => (
                  <span
                    key={index}
                    className={`w-3 rounded-t ${index === kpi.shares.length - 1 ? (kpi.good ? 'bg-primary' : 'bg-hero-current') : 'bg-track'}`}
                    style={{ height: `${String(Math.max(4, Math.round(share * 28)))}px` }}
                  />
                ))}
              </span>
            </Card>
          </li>
        ))}
      </ul>
      <People data={data} />
      <Oldest data={data} />
    </>
  );
}

const cell = 'px-3 py-3.5 first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';

function People({ data }: { data: HealthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const people = [...data.people].sort((a, b) => a.on_time - b.on_time);
  return (
    <SectionCard
      id="health-people"
      title={t('manager.health.people')}
      subtitle={t('manager.health.peopleHint')}
    >
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-[13px] text-text-2">
              {PEOPLE_COLUMNS.map((column) => (
                <th key={column} scope="col" className={`${cell} py-2 text-start font-medium`}>
                  {t(`manager.health.column.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="shadow-[inset_0_1px_0_var(--hair)]">
                <th scope="row" className={`${cell} text-start font-semibold`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={person.name} size="sm" />
                    {person.name}
                  </span>
                </th>
                <td className={cell}>
                  <Chip tone={person.role === 'sales' ? 'warn' : 'info'} small>
                    {t(`manager.health.role.${person.role}`)}
                  </Chip>
                </td>
                <td className={cell}>
                  <span className="flex items-center gap-2.5">
                    <ProgressBar
                      value={Math.round(person.on_time * 100)}
                      size="sm"
                      tone={person.on_time < LOW_ON_TIME ? 'warn' : 'primary'}
                      className="w-20"
                    />
                    {s.percent(person.on_time)}
                  </span>
                </td>
                <td className={`${cell} ${person.overdue >= 5 ? 'font-semibold text-urgent' : ''}`}>
                  {f.number(person.overdue)}
                </td>
                <td className={`${cell} ${person.orphans >= 3 ? 'font-semibold text-urgent' : ''}`}>
                  {f.number(person.orphans)}
                </td>
                <td className={cell}>{f.number(person.snoozed)}</td>
                <td className={cell}>
                  {person.oldest_days === null
                    ? t('due.none')
                    : t('board.age.days', { n: f.number(person.oldest_days) })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function Oldest({ data }: { data: HealthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const manage = useManageTask();
  const [handing, setHanding] = useState<number | null>(null);
  const [assignee, setAssignee] = useState('');
  const [reminded, setReminded] = useState<ReadonlySet<number>>(new Set());

  return (
    <SectionCard
      id="health-oldest"
      title={t('manager.health.oldest')}
      subtitle={t('manager.health.oldestHint')}
    >
      <ul className="m-0 list-none p-0 pb-2">
        {data.oldest.map((item) => {
          const first = item.owner.name.split(' ')[0] ?? item.owner.name;
          const others = data.colleagues.filter((colleague) => colleague.id !== item.owner.id);
          return (
            <li
              key={item.task}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="w-16 flex-none text-base font-bold text-urgent">
                {t('board.age.days', { n: f.number(item.days) })}
              </span>
              <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                <span className="text-[15px] font-semibold">{item.text}</span>
                <span className="text-[13px] text-text-2">
                  {t('manager.health.owner', {
                    person: item.person,
                    about: item.context,
                    owner: item.owner.name,
                  })}
                </span>
              </span>
              {handing === item.task ? (
                <span className="flex flex-wrap items-center gap-2">
                  <SelectField
                    inline
                    label={t('manager.health.handTo')}
                    value={assignee}
                    onChange={setAssignee}
                    options={[
                      { value: '', label: t('customer.logDialog.choose') },
                      ...others.map((colleague) => ({
                        value: String(colleague.id),
                        label: colleague.name,
                      })),
                    ]}
                  />
                  <Button
                    className="h-11 px-4 text-sm"
                    disabled={!assignee || manage.isPending}
                    onClick={() =>
                      manage.mutate(
                        { task: item.task, assignee: Number(assignee) },
                        { onSuccess: () => setHanding(null) },
                      )
                    }
                  >
                    {t('manager.health.hand')}
                  </Button>
                </span>
              ) : (
                <span className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    disabled={reminded.has(item.task) || manage.isPending}
                    onClick={() =>
                      manage.mutate(
                        { task: item.task },
                        { onSuccess: () => setReminded(new Set([...reminded, item.task])) },
                      )
                    }
                  >
                    {reminded.has(item.task)
                      ? t('manager.health.reminded')
                      : t('manager.health.remind', { name: first })}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    onClick={() => {
                      setAssignee('');
                      setHanding(item.task);
                    }}
                  >
                    {t('manager.health.handOver')}
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {manage.isError && (
        <div className="px-5 pb-5 lg:px-8">
          <Notice tone="error">{t('error')}</Notice>
        </div>
      )}
    </SectionCard>
  );
}
