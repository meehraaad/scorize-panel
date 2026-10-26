import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Pager } from '@/components/ui/Pager';
import { ProgressBar } from '@/components/ui/Progress';
import { Badge, SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { percentOf } from '@/lib/progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { useConfirmReceipt } from '@/lib/sales/api';
import { safeHref } from '@/lib/url';
import { receiptsQuery, type MonthSummary, type TodayData } from '../api';
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';
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

/** Receipts shown at once: the card stays short beside the rest of the day. */
export const RECEIPTS_SHOWN = 3;

/** Receipts waiting for a seller, three at a time: the badge counts all of them. */
export function ReceiptsCard() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const confirm = useConfirmReceipt();
  const [page, setPage] = useState(1);
  // Django pages receipts by its own size: this card's short page is read from the one or two
  // server pages under it (page 1 answers the size).
  const head = useQuery(receiptsQuery(1)).data;
  const size = Math.max(1, head?.page_size ?? RECEIPTS_SHOWN);
  const start = (page - 1) * RECEIPTS_SHOWN;
  const from = Math.floor(start / size) + 1;
  const to = Math.floor((start + RECEIPTS_SHOWN - 1) / size) + 1;
  const first = useQuery(receiptsQuery(from));
  const second = useQuery({ ...receiptsQuery(to), enabled: to !== from });
  const loaded = first.data !== undefined && (to === from || second.data !== undefined);
  const shown = head && { count: head.count, page_size: RECEIPTS_SHOWN };
  const pages = pagesOf(shown);
  useClampPage(shown, page, setPage);
  const offset = start - (from - 1) * size;
  const receipts = [
    ...(first.data?.results ?? []),
    ...(to !== from ? (second.data?.results ?? []) : []),
  ].slice(offset, offset + RECEIPTS_SHOWN);
  return (
    <SectionCard
      id="today-receipts"
      variant="panel"
      title={t('today.receipts.title')}
      badge={head && head.count > 0 && <Badge>{f.number(head.count)}</Badge>}
    >
      {!loaded ? (
        <SkeletonRows rows={RECEIPTS_SHOWN} />
      ) : receipts.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('today.receipts.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
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
      {head && head.count > 0 && (
        <Pager
          inset
          status={t('today.receipts.pager', {
            from: f.number(Math.min(start + 1, head.count)),
            to: f.number(Math.min(start + RECEIPTS_SHOWN, head.count)),
            total: f.number(head.count),
          })}
          page={page}
          pages={pages}
          pending={!loaded}
          onPage={setPage}
        />
      )}
    </SectionCard>
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
