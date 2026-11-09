import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { historyQuery, type HistoryEvent, type HistoryKind } from '../api';

const LOOK: Record<HistoryKind, { icon: IconName; tone: string }> = {
  call: { icon: 'phone', tone: 'bg-tint text-primary-text' },
  no_answer: { icon: 'phone', tone: 'bg-warn-tint text-warn' },
  message: { icon: 'send', tone: 'bg-neutral-tint text-neutral' },
  meeting: { icon: 'user', tone: 'bg-info-tint text-info' },
  note: { icon: 'pen', tone: 'bg-neutral-tint text-neutral' },
  payment: { icon: 'card', tone: 'bg-good-tint text-good' },
  payment_failed: { icon: 'card', tone: 'bg-warn-tint text-warn' },
  lead: { icon: 'star', tone: 'bg-tint text-primary-text' },
  assign: { icon: 'user', tone: 'bg-neutral-tint text-neutral' },
};

/** The history's filter: everything, the conversations, the money, or the team and its stages. */
const FILTERS = {
  all: null,
  contact: ['call', 'no_answer', 'message', 'meeting', 'note'],
  money: ['payment', 'payment_failed'],
  team: ['lead', 'assign'],
} as const satisfies Record<string, readonly HistoryKind[] | null>;
type Filter = keyof typeof FILTERS;

/** Calls, messages, sessions, purchases and payments in one timeline, newest first. */
export function HistoryCard({ customer }: { customer: number }) {
  const { t } = useTranslation('sales');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    historyQuery(customer),
  );
  const kinds: readonly HistoryKind[] | null = FILTERS[filter];
  const events = (data?.pages.flatMap((page) => page.results) ?? []).filter(
    (event) => kinds === null || kinds.includes(event.kind),
  );

  return (
    <SectionCard
      id="customer-history"
      title={t('customer.history.title')}
      end={
        <ChoiceGroup
          legend={t('customer.history.filter')}
          hideLegend
          look="segmented"
          value={filter}
          onChange={setFilter}
          options={(Object.keys(FILTERS) as Filter[]).map((value) => ({
            value,
            label: t(`customer.history.filters.${value}`),
          }))}
        />
      }
    >
      {isPending ? (
        <SkeletonRows rows={4} />
      ) : events.length === 0 ? (
        <EmptyState>
          {t(filter === 'all' ? 'customer.history.empty' : 'customer.history.emptyFilter')}
        </EmptyState>
      ) : (
        <ol className="m-0 list-none p-0">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ol>
      )}
      {hasNextPage && (
        <div className="px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t('customer.history.more')}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function EventRow({ event }: { event: HistoryEvent }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const look = LOOK[event.kind];
  const author = event.author ?? t('customer.history.system');
  // Django's history doesn't say who a lead went to.
  const key =
    event.kind === 'lead' && !event.author
      ? 'leadNew'
      : event.kind === 'assign' && !event.previous
        ? 'assignFirst'
        : event.kind;
  const title = t(`customer.history.event.${key}`, {
    author,
    channel: event.channel ? t(`channel.${event.channel}`) : '',
    title: event.title ?? (event.kind === 'assign' ? t('due.none') : ''),
    previous: event.previous ?? '',
  });
  return (
    <li className="flex gap-4 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
      <span
        aria-hidden="true"
        className={`flex size-[38px] flex-none items-center justify-center rounded-xl ${look.tone}`}
      >
        <Icon name={look.icon} size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold">{title}</span>
          <time dateTime={event.at} className="text-xs text-text-2">
            {f.timeAgo(event.at)}
          </time>
        </div>
        {event.text && <p className="m-0 text-sm leading-7 text-neutral">{event.text}</p>}
        {event.customer_summary && (
          <div className="rounded-xl bg-info-tint p-3">
            <span className="text-xs font-semibold text-text-2">
              {t('customer.logDialog.customerSummary')}
            </span>
            <p className="m-0 text-sm leading-7 break-words whitespace-pre-wrap">
              {event.customer_summary}
            </p>
          </div>
        )}
        {event.stage && (
          <span>
            <Chip tone="info" small>
              {t('customer.history.stageTag', { stage: t(`stage.${event.stage}`) })}
            </Chip>
          </span>
        )}
      </div>
    </li>
  );
}
