import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  SERVICE_REPORT_PERIODS,
  servicesReportQuery,
  type ResponseNumbers,
  type ServiceReportPeriod,
} from './api';

const MINUTES_IN_HOUR = 60;
/** Django's TeamType names in lower case, as the report sends them. */
const TEAMS = [
  'sales',
  'executive',
  'marketing',
  'management',
  'support',
  'technical',
  'writing',
  'search',
  'language',
  'visa',
] as const;
const isTeam = (team: string | null): team is (typeof TEAMS)[number] =>
  TEAMS.some((known) => known === team);

/**
 * How the services are answered (SVC6), per team and per owner: open services, conversations
 * waiting for an answer, answers in the period, the median time to answer and the slow ones.
 * Managers see every service; a supervisor their scopes' and their own.
 */
export default function ServicesReportPage() {
  const { t } = useTranslation('supervisor');
  const [period, setPeriod] = useState<ServiceReportPeriod>('month');
  const { data, isPlaceholderData } = useQuery(servicesReportQuery(period));

  return (
    <PageStack>
      <PageHeader
        title={t('servicesReport.title')}
        subtitle={t('servicesReport.subtitle')}
        actions={
          <FilterTabs
            label={t('servicesReport.period')}
            value={period}
            onChange={setPeriod}
            options={SERVICE_REPORT_PERIODS.map((value) => ({
              value,
              label: t(`servicesReport.periods.${value}`),
            }))}
          />
        }
      />
      {data ? (
        <div aria-busy={isPlaceholderData} className="contents">
          <NumbersCard
            id="report-teams"
            title={t('servicesReport.teams')}
            rows={data.teams.map((row) => ({
              key: row.team ?? 'none',
              name: isTeam(row.team)
                ? t(`servicesReport.team.${row.team}`)
                : (row.team ?? t('servicesReport.noTeam')),
              numbers: row,
            }))}
          />
          <NumbersCard
            id="report-owners"
            title={t('servicesReport.owners')}
            rows={data.owners.map((row) => ({
              key: String(row.id ?? 'none'),
              name: row.name ?? t('servicesReport.noOwner'),
              numbers: row,
            }))}
          />
        </div>
      ) : (
        <SkeletonRows rows={6} />
      )}
    </PageStack>
  );
}

function NumbersCard({
  id,
  title,
  rows,
}: {
  id: string;
  title: string;
  rows: { key: string; name: string; numbers: ResponseNumbers }[];
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const median = (minutes: number | null) =>
    minutes === null
      ? t('dash')
      : minutes < MINUTES_IN_HOUR
        ? t('servicesReport.minutes', { n: f.number(minutes) })
        : t('servicesReport.hours', { n: f.number(Math.round(minutes / MINUTES_IN_HOUR)) });
  const cell = (label: string, value: ReactNode, warn = false) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className={`m-0 text-[15px] tabular-nums ${warn ? 'font-semibold text-warn' : ''}`}>
        {value}
      </dd>
    </div>
  );
  return (
    <SectionCard id={id} title={title}>
      {rows.length === 0 ? (
        <p className="m-0 px-5 pb-5 text-[15px] text-text-2 lg:px-8">{t('servicesReport.empty')}</p>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {rows.map(({ key, name, numbers }) => (
            <li
              key={key}
              className="flex flex-col gap-2 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="text-[15px] font-semibold">{name}</span>
              <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
                {cell(t('servicesReport.services'), f.number(numbers.services))}
                {cell(t('servicesReport.waiting'), f.number(numbers.waiting), numbers.waiting > 0)}
                {cell(t('servicesReport.answered'), f.number(numbers.answered))}
                {cell(t('servicesReport.median'), median(numbers.median_minutes))}
                {cell(t('servicesReport.slow'), f.number(numbers.slow), numbers.slow > 0)}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
