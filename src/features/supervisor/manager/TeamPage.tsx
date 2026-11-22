import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid, type Stat } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { managerTeamQuery, type TeamPerson } from '../api';
import { managerPath, teamCasesPath } from '../paths';

/**
 * The manager's team (`can_assign_supervisor`): each supervisor's and visa expert's open cases,
 * cases waiting for an answer, services and tasks, the busiest first. A name opens that person's
 * cases in the manager's list of every case.
 */
export default function TeamPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { data } = useQuery(managerTeamQuery);

  const stats: Stat[] = data
    ? [
        { label: t('manager.team.totals.cases'), value: f.number(data.totals.cases) },
        {
          label: t('manager.team.totals.waiting'),
          value: f.number(data.totals.waiting),
          ...(data.totals.waiting > 0 && { tone: 'urgent' as const }),
        },
        {
          label: t('manager.team.totals.noSupervisor'),
          value: f.number(data.totals.no_supervisor),
          ...(data.totals.no_supervisor > 0 && { tone: 'urgent' as const }),
        },
        ...(data.totals.unowned_services === null
          ? []
          : [
              {
                label: t('manager.team.totals.unownedServices'),
                value: f.number(data.totals.unowned_services),
                ...(data.totals.unowned_services > 0 && { tone: 'urgent' as const }),
              },
            ]),
      ]
    : [];

  return (
    <PageStack>
      <PageHeader title={t('manager.team.title')} subtitle={t('manager.team.subtitle')} />
      {data ? (
        <>
          <StatGrid label={t('manager.team.totals.label')} stats={stats} />
          {(data.totals.no_supervisor > 0 || (data.totals.unowned_services ?? 0) > 0) && (
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {data.totals.no_supervisor > 0 && (
                <Link to={teamCasesPath('none')} className="text-primary-text hover:underline">
                  {t('manager.team.openNoSupervisor')}
                </Link>
              )}
              {(data.totals.unowned_services ?? 0) > 0 && (
                <Link to={managerPath()} className="text-primary-text hover:underline">
                  {t('manager.team.openUnowned')}
                </Link>
              )}
            </p>
          )}
          <SectionCard id="manager-team" title={t('manager.team.people')}>
            {data.people.length === 0 ? (
              <p className="m-0 px-5 pb-5 text-[15px] text-text-2 lg:px-8">
                {t('manager.team.empty')}
              </p>
            ) : (
              <ul className="m-0 list-none p-0 pb-2">
                {data.people.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : (
        <SkeletonRows rows={6} />
      )}
    </PageStack>
  );
}

function PersonRow({ person }: { person: TeamPerson }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const cell = (label: string, value: ReactNode, warn = false) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className={`m-0 text-[15px] tabular-nums ${warn ? 'font-semibold text-warn' : ''}`}>
        {value}
      </dd>
    </div>
  );
  return (
    <li
      aria-label={person.name}
      className="flex flex-col gap-2 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Link
          to={teamCasesPath(person.id)}
          className="text-[15px] font-semibold text-text hover:underline"
        >
          {person.name}
        </Link>
        <span className="text-[13px] text-text-2">
          {[t(`manager.team.kind.${person.team}`), ...person.countries].join(' · ')}
        </span>
      </span>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
        {cell(t('manager.team.cases'), f.number(person.cases))}
        {cell(
          t('manager.team.waiting'),
          person.waiting_since
            ? t('manager.team.waitingSince', {
                n: f.number(person.waiting),
                since: f.timeAgo(person.waiting_since),
              })
            : f.number(person.waiting),
          person.waiting > 0,
        )}
        {person.services !== null && cell(t('manager.team.services'), f.number(person.services))}
        {cell(t('manager.team.tasks'), f.number(person.tasks))}
        {cell(t('manager.team.overdue'), f.number(person.overdue), person.overdue > 0)}
      </dl>
    </li>
  );
}
