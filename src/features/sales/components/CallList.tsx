import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CallBucket, CallItem } from '../api';
import { useSalesFormat } from '../format';
import { customerPath, salesPath } from '../paths';
import { ContactButtons } from './ContactButtons';
import { ScoreChip } from './LeadChips';

type Tab = CallBucket | 'all';
const TABS: readonly Tab[] = ['all', 'new', 'today', 'overdue'];

/** Today's call list: new leads, today’s follow-ups, overdue follow-ups, then by score (the server's order). */
export function CallList({
  calls,
  counts,
  tab,
  onTab,
}: {
  calls: CallItem[];
  counts: Record<Tab, number> | undefined;
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const shown = calls;

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
          onChange={onTab}
          options={TABS.map((value) => ({
            value,
            label: t(`today.list.tab.${value}`),
            count: f.number(counts?.[value] ?? 0),
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
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:flex-nowrap lg:px-8"
              >
                <Avatar name={call.name} />
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={customerPath(call.customer)}
                      className="text-base font-semibold text-text hover:underline"
                    >
                      {call.name}
                    </Link>
                    <ScoreChip score={call.score} />
                  </div>
                  <span className="text-sm leading-6 text-text-2">{call.reason}</span>
                </div>
                <div className="flex w-40 flex-none flex-col gap-0.5">
                  <span
                    className={`text-sm font-semibold ${due.urgent ? 'text-urgent' : 'text-text'}`}
                  >
                    {due.text}
                  </span>
                  <span className="text-xs text-text-2">
                    {t('today.list.stage', { stage: t(`stage.${call.stage}`) })}
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
      <p className="m-0 px-5 py-4 text-xs text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
        {t('today.list.order')}
      </p>
    </SectionCard>
  );
}
