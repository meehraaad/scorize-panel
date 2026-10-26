import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CallBucket, CallItem } from '../api';
import { useSalesFormat } from '../format';
import { customerPath, salesPath } from '../paths';
import { ContactButtons } from './ContactButtons';
import { ScoreChip } from './LeadChips';

type Tab = CallBucket | 'all';
const TABS: readonly Tab[] = ['all', 'today', 'overdue', 'new'];
/** Rows per page: the list stays short enough to work through without scrolling past the calendar. */
export const CALLS_PAGE = 6;

/**
 * Today's follow-ups and calls, a page at a time: new leads, then overdue follow-ups, then by score
 * (the server's order). The whole list comes with `today/`, so it pages here.
 */
export function CallList({ calls }: { calls: CallItem[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const filtered = calls.filter((call) => tab === 'all' || call.bucket === tab);
  const pages = Math.max(1, Math.ceil(filtered.length / CALLS_PAGE));
  // The list refreshes every minute: a call done on the last page can empty it.
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * CALLS_PAGE, current * CALLS_PAGE);

  const dueOf = (call: CallItem) => {
    if (call.bucket === 'new') return { text: t('today.list.dueNew'), urgent: true };
    if (call.bucket === 'today' && call.follow_up_at)
      return { text: t('today.list.dueToday', { time: f.time(call.follow_up_at) }), urgent: false };
    return s.due(call.follow_up_at, call.stage, true);
  };

  return (
    <SectionCard
      id="calls-title"
      title={t('today.list.title')}
      end={
        <Link to={salesPath('leads')} className="text-sm font-medium text-primary-text">
          {t('today.list.all')}
        </Link>
      }
    >
      <div className="px-5 pb-3 lg:px-8">
        <FilterTabs
          label={t('today.list.filter')}
          value={tab}
          onChange={(value) => {
            setTab(value);
            setPage(1);
          }}
          options={TABS.map((value) => ({
            value,
            label: t(`today.list.tab.${value}`),
            count: f.number(
              value === 'all' ? calls.length : calls.filter((call) => call.bucket === value).length,
            ),
          }))}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState>{t('today.list.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0">
          {shown.map((call) => {
            const due = dueOf(call);
            return (
              <li
                key={call.lead}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] sm:flex-nowrap lg:px-8"
              >
                <Avatar name={call.name} />
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={customerPath(call.customer)}
                      className="text-base font-semibold text-text hover:underline"
                    >
                      {call.name}
                    </Link>
                    <ScoreChip score={call.score} />
                  </div>
                  <span className="line-clamp-2 text-sm leading-6 text-text-2">{call.reason}</span>
                  <span className="text-xs">
                    <span className={`font-semibold ${due.urgent ? 'text-urgent' : 'text-text'}`}>
                      {due.text}
                    </span>
                    <span className="text-text-2">
                      {' · '}
                      {t('today.list.stage', { stage: t(`stage.${call.stage}`) })}
                    </span>
                  </span>
                </div>
                <ContactButtons
                  customer={call.customer}
                  name={call.name}
                  phone={call.phone}
                  messages={false}
                />
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length > CALLS_PAGE && (
        <Pager
          status={t('today.list.pager', {
            from: f.number((current - 1) * CALLS_PAGE + 1),
            to: f.number((current - 1) * CALLS_PAGE + shown.length),
            total: f.number(filtered.length),
          })}
          page={current}
          pages={pages}
          onPage={setPage}
        />
      )}
      <p className="m-0 px-5 py-4 text-xs text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
        {t('today.list.order')}
      </p>
    </SectionCard>
  );
}
