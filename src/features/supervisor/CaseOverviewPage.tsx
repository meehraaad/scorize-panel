import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageColumns } from '@/components/ui/PageColumns';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { daysBetween, daysUntil, isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { safeHref } from '@/lib/url';
import { caseQuery, type CaseData, type InstallmentStatus } from './api';
import { NewTaskDialog } from './components/NewTaskDialog';
import { casePath, supervisorPath } from './paths';
import { useCaseId } from './useCaseId';

/** The case file's first tab. Canvas V1 "پرونده متقاضی · نمای کلی". */
export default function CaseOverviewPage() {
  const { t } = useTranslation('supervisor');
  const { data } = useSuspenseQuery(caseQuery(useCaseId()));
  // The layout shows "not found" for a missing case; nothing to add here.
  if (!data) return null;
  return (
    <PageColumns
      asideLabel={t('overview.aside')}
      main={
        <>
          <Progress data={data} />
          <Contract data={data} />
          <Installments data={data} />
        </>
      }
      aside={
        <>
          <Tasks data={data} />
          <Activity data={data} />
        </>
      }
    />
  );
}

function Progress({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { progress } = data;
  return (
    <StatGrid
      label={t('overview.progress.label')}
      stats={[
        { label: t('overview.progress.suggested'), value: f.number(progress.suggested) },
        { label: t('overview.progress.applied'), value: f.number(progress.applied) },
        {
          label: t('overview.progress.accepted'),
          value: f.number(progress.accepted),
          tone: progress.accepted > 0 ? 'good' : 'default',
        },
        {
          label: t('overview.progress.emails'),
          value: f.number(progress.emails_sent),
          unit: t('overview.progress.of', { n: f.number(progress.emails_total) }),
        },
      ]}
    />
  );
}

function Contract({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { contract } = data;
  const total = daysBetween(contract.started_at, contract.ends_at);
  const left = daysUntil(contract.ends_at);
  const passed = percentOf(total - left, total);
  const facts: [string, ReactNode][] = [
    [t('overview.contract.start'), f.date(contract.started_at)],
    [t('overview.contract.end'), f.date(contract.ends_at)],
    [
      t('overview.contract.total'),
      contract.total ? f.money(contract.total.amount, contract.total.currency) : t('free'),
    ],
    [t('overview.contract.phone'), <bdi key="phone">{f.digits(data.phone)}</bdi>],
    [t('overview.contract.email'), <bdi key="email">{data.email}</bdi>],
  ];

  return (
    <SectionCard id="case-contract" title={t('overview.contract.title')}>
      <div className="flex flex-col gap-6 px-5 pt-2 pb-6 lg:px-8 lg:pb-8">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-medium">
              {t('overview.contract.left', { left: f.number(left), total: f.number(total) })}
            </span>
            <span className="text-text-2">
              {t('overview.contract.passed', { n: f.number(passed) })}
            </span>
          </div>
          <ProgressBar value={passed} tone={left === 0 ? 'warn' : 'primary'} />
        </div>
        <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-[13px] text-text-2">{label}</dt>
              <dd className="m-0 text-[15px]">{value}</dd>
            </div>
          ))}
          {contract.files.length > 0 && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-[13px] text-text-2">{t('overview.contract.files')}</dt>
              <dd className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                {contract.files.map((file) => (
                  <a
                    key={file.url}
                    href={safeHref(file.url)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 font-medium text-primary-text hover:underline"
                  >
                    <Icon name="document" size={16} />
                    {file.name}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </SectionCard>
  );
}

const INSTALLMENT_TONE: Record<InstallmentStatus, ChipTone> = {
  paid: 'good',
  due: 'warn',
  overdue: 'danger',
  upcoming: 'neutral',
};

function Installments({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const overdue = data.installments.some((item) => item.status === 'overdue');
  return (
    <SectionCard
      id="case-installments"
      title={t('overview.installments.title')}
      end={
        data.installments.length > 0 && (
          <span className={`text-sm font-medium ${overdue ? 'text-danger' : 'text-good'}`}>
            {t(overdue ? 'overview.installments.overdue' : 'overview.installments.clear')}
          </span>
        )
      }
    >
      {data.installments.length === 0 ? (
        <EmptyState>{t('overview.installments.empty')}</EmptyState>
      ) : (
        <ol className="m-0 list-none p-0 pb-2">
          {data.installments.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex-[1_1_140px] text-[15px] font-medium">
                {item.number === 0
                  ? t('overview.installments.prepayment')
                  : t('overview.installments.number', { n: f.number(item.number) })}
              </span>
              <span className="flex-[0_0_120px] text-sm tabular-nums">
                {f.money(item.amount.amount, item.amount.currency)}
              </span>
              <span className="flex-[1_1_140px] text-sm text-text-2">
                {item.due_date ? f.date(item.due_date) : (item.condition ?? t('dash'))}
              </span>
              <Chip tone={INSTALLMENT_TONE[item.status]} small>
                {t(`overview.installments.status.${item.status}`)}
              </Chip>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function Tasks({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [open, setOpen] = useState(false);
  return (
    <SectionCard
      id="case-tasks"
      variant="panel"
      title={t('overview.tasks.title')}
      end={
        <Button variant="outline" className="h-11 px-4 text-sm" onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} />
          {t('overview.tasks.add')}
        </Button>
      }
    >
      {data.tasks.length === 0 ? (
        <p className="m-0 text-[15px] leading-7 text-text-2">{t('overview.tasks.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.tasks.map((task) => {
            const late = isPast(task.due_at);
            return (
              <li key={task.id} className="flex flex-col gap-0.5">
                <span className="text-[15px] leading-7">{task.text}</span>
                <span
                  className={`text-[13px] ${late ? 'font-semibold text-danger' : 'text-text-2'}`}
                >
                  {late
                    ? t('overview.tasks.late', { when: f.timeAgo(task.due_at) })
                    : t('overview.tasks.due', { when: f.dateTime(task.due_at) })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to={supervisorPath('tasks')}
        className="text-sm font-semibold text-primary-text hover:underline"
      >
        {t('overview.tasks.all')}
      </Link>
      <NewTaskDialog
        key={open ? 'task-open' : 'task-closed'}
        caseId={data.id}
        user={data.user}
        name={data.name}
        open={open}
        onClose={() => setOpen(false)}
      />
    </SectionCard>
  );
}

function Activity({ data }: { data: CaseData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  return (
    <SectionCard
      id="case-activity"
      variant="panel"
      title={t('overview.activity.title')}
      end={
        <Link
          to={casePath(data.id, 'activity')}
          className="text-sm font-semibold text-primary-text hover:underline"
        >
          {t('overview.activity.all')}
        </Link>
      }
    >
      {data.activity.length === 0 ? (
        <p className="m-0 text-[15px] leading-7 text-text-2">{t('activity.empty')}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {data.activity.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-0.5 py-3 not-first:shadow-[inset_0_1px_0_var(--hair)]"
            >
              <span className="text-[15px] leading-7">{item.text}</span>
              <span className="text-[13px] text-text-2">{f.timeAgo(item.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
