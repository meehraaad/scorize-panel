import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { QuerySection } from '@/components/ui/QuerySection';
import { Pager } from '@/components/ui/Pager';
import { ProgressBar } from '@/components/ui/Progress';
import { Badge, SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { percentOf } from '@/lib/progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { useConfirmReceipt } from '@/lib/sales/api';
import { safeHref } from '@/lib/url';
import { receiptsQuery, type MonthSummary, type TodayConsultation, type TodayData } from '../api';
import { useSalesFormat } from '../format';
import { customerPath, salesPath } from '../paths';
import { toast } from '@/lib/toast';

/** "My tasks": one link with the three counts (the tasks page). */
export function TasksCard({ tasks }: { tasks: TodayData['tasks'] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const counts = [
    { key: 'overdue', value: tasks.overdue, urgent: tasks.overdue > 0 },
    { key: 'requests', value: tasks.requests, urgent: false },
    { key: 'team', value: tasks.team, urgent: false },
  ] as const;
  return (
    <Link
      to={salesPath('tasks')}
      aria-label={t('today.tasks.label', {
        overdue: f.number(tasks.overdue),
        requests: f.number(tasks.requests),
        team: f.number(tasks.team),
      })}
      className="flex flex-col gap-4 rounded-card-sm bg-surface p-5 text-text shadow-panel hover:shadow-[0_0_0_1.5px_var(--primary)] lg:rounded-card lg:p-7"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-base font-bold">{t('today.tasks.title')}</span>
        <span className="text-sm text-primary-text">{t('today.tasks.all')}</span>
      </span>
      <span className="grid grid-cols-3 gap-2">
        {counts.map((count) => (
          <span key={count.key} className="flex flex-col gap-1 rounded-2xl bg-canvas px-3 py-2.5">
            <span
              className={`text-xl font-bold tabular-nums ${count.urgent ? 'text-urgent' : 'text-text'}`}
            >
              {f.number(count.value)}
            </span>
            <span className="text-xs text-text-2">{t(`today.tasks.${count.key}`)}</span>
          </span>
        ))}
      </span>
    </Link>
  );
}

export function TodayConsultationsCard({ consultations }: { consultations: TodayConsultation[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  // Read once: the side card doesn't need to re-render by the minute.
  const [now] = useState(() => Date.now());
  return (
    <SectionCard
      id="today-consultations"
      variant="panel"
      title={t('today.consultations.title')}
      end={
        <Link to={salesPath('consultations')} className="text-sm text-primary-text">
          {t('today.consultations.all')}
        </Link>
      }
    >
      {consultations.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('today.consultations.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {consultations.map((item) => {
            const past = new Date(item.starts_at).getTime() < now;
            return (
              <li key={item.id} className="flex items-center gap-3">
                <span
                  className={`w-12 flex-none text-sm font-bold tabular-nums ${past ? 'text-text-2' : 'text-text'}`}
                >
                  {f.time(item.starts_at)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <Link
                    to={customerPath(item.customer)}
                    className="truncate text-[15px] font-semibold text-text hover:underline"
                  >
                    {item.name}
                  </Link>
                  <span className="truncate text-xs text-text-2">
                    {t('today.consultations.type', {
                      type: item.type,
                      mode: t(`mode.${item.mode}`),
                    })}
                  </span>
                </span>
                {item.logged ? (
                  <span className="text-xs text-good">{t('today.consultations.logged')}</span>
                ) : past ? (
                  <Link
                    to={customerPath(item.customer, 'meeting', item.id)}
                    aria-label={t('today.consultations.logName', { name: item.name })}
                    className={buttonClass('outline', 'h-11 px-3.5 text-sm')}
                  >
                    {t('today.consultations.log')}
                  </Link>
                ) : (
                  <Link
                    to={customerPath(item.customer)}
                    aria-label={t('today.consultations.prepareName', { name: item.name })}
                    className={buttonClass('outline', 'h-11 px-3.5 text-sm')}
                  >
                    {t('today.consultations.prepare')}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/** Receipts waiting for a seller, a page at a time: the badge counts all of them. */
export function ReceiptsCard() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const confirm = useConfirmReceipt();
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData, isPending, error, refetch } = useQuery(receiptsQuery(page));
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);
  const receipts = data?.results ?? [];
  return (
    <QuerySection
      pending={isPending}
      error={error}
      retry={() => {
        void refetch();
      }}
    >
      <SectionCard
        id="today-receipts"
        variant="panel"
        title={t('today.receipts.title')}
        badge={data && data.count > 0 && <Badge>{f.number(data.count)}</Badge>}
      >
        {!data ? (
          <SkeletonRows rows={2} />
        ) : receipts.length === 0 ? (
          <p className="m-0 text-sm text-text-2">{t('today.receipts.empty')}</p>
        ) : (
          <ul aria-busy={isPlaceholderData} className="m-0 flex list-none flex-col gap-4 p-0">
            {receipts.map((receipt) => (
              <li key={receipt.payment} className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold">{receipt.name}</span>
                  <span className="text-sm font-bold tabular-nums">{s.toman(receipt.amount)}</span>
                </span>
                <span className="text-xs leading-6 text-text-2">
                  {t('today.receipts.what', {
                    what: receipt.what,
                    method: t(`today.receipts.method.${receipt.method}`),
                    when: f.timeAgo(receipt.uploaded_at),
                  })}
                </span>
                <span className="flex gap-2">
                  <a
                    href={safeHref(receipt.receipt_url)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('today.receipts.viewName', { name: receipt.name })}
                    className={buttonClass('outline', 'h-11 flex-1 px-3 text-sm')}
                  >
                    {t('today.receipts.view')}
                  </a>
                  <Button
                    className="h-11 flex-1 px-3 text-sm"
                    aria-label={t('today.receipts.confirmName', { name: receipt.name })}
                    disabled={confirm.isPending}
                    onClick={() =>
                      confirm.mutate(
                        { customer: receipt.customer, payment: receipt.payment },
                        {
                          onSuccess: () =>
                            toast.success(t('today.receipts.confirmed', { name: receipt.name })),
                          onError: () => toast.error(t('today.receipts.error')),
                        },
                      )
                    }
                  >
                    {t('today.receipts.confirm')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <Pager inset page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
        )}
      </SectionCard>
    </QuerySection>
  );
}

export function MonthCard({ month }: { month: MonthSummary }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  return (
    <SectionCard
      id="today-month"
      variant="panel"
      title={t('today.month.title')}
      end={
        <Link to={salesPath('month')} className="text-sm text-primary-text">
          {t('today.month.details')}
        </Link>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-text-2">{t('today.month.won')}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums">{f.number(month.won)}</span>
            <span className="text-xs text-text-2">
              {t('today.month.ofTarget', { n: f.number(month.target) })}
            </span>
          </span>
        </span>
        <ProgressBar value={percentOf(month.won, month.target)} />
        <span className="text-xs leading-6 text-text-2">
          {t('today.month.left', {
            days: f.number(month.working_days_left),
            drafts: f.number(month.drafts_waiting),
          })}
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-2xl bg-canvas px-3 py-2.5">
          <dt className="text-xs text-text-2">{t('today.month.conversion')}</dt>
          <dd className="m-0 text-lg font-bold">{s.percent(month.conversion)}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-canvas px-3 py-2.5">
          <dt className="text-xs text-text-2">{t('today.month.firstCall')}</dt>
          <dd className="m-0 text-lg font-bold">{s.minutes(month.first_call_minutes)}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}
