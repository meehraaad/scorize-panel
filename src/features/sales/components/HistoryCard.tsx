import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { SearchField } from '@/components/ui/Filters';
import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { historyQuery, type HistoryEvent, type HistoryKind } from '../api';
import { CallRecordingPlayer } from './CustomerCallRecordings';
import { useCallRecordings } from './useCallRecordings';

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

/** Fewer letters than this match too much (the server ignores them). */
const MIN_LETTERS = 2;

/**
 * Calls, messages, sessions, purchases and payments in one timeline, newest first. With
 * `historySearch`, a search box finds words in the notes, summaries and descriptions (S78).
 */
export function HistoryCard({ customer }: { customer: number }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [playing, setPlaying] = useState<string>();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const settled = useDebouncedValue(search.trim(), 300);
  const q =
    ON_SERVER.historySearch && settled.replace(/\s/g, '').length >= MIN_LETTERS ? settled : '';
  const { data, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    historyQuery(customer, q),
  );
  const kinds: readonly HistoryKind[] | null = FILTERS[filter];
  const showsRecordings = (filter === 'all' || filter === 'contact') && !q;
  const { data: recordings, error: recordingsError } = useCallRecordings(customer, showsRecordings);
  const history = data?.pages.flatMap((page) => page.results) ?? [];
  const events = history.filter((event) => kinds === null || kinds.includes(event.kind));
  // Older recordings enter the timeline as history pages are loaded.
  const oldest = history.at(-1)?.at;
  const calls = showsRecordings
    ? (recordings?.results ?? []).filter(
        (call) => !hasNextPage || !oldest || Date.parse(call.at) >= Date.parse(oldest),
      )
    : [];
  const timeline = [...events, ...calls.map((call) => ({ ...call, kind: 'recording' as const }))];
  if (calls.length) timeline.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <SectionCard
      id="customer-history"
      title={t('customer.history.title')}
      end={
        <div className="flex flex-wrap items-center gap-3">
          {ON_SERVER.historySearch && (
            <SearchField
              label={t('customer.history.search')}
              placeholder={t('customer.history.searchPlaceholder')}
              value={search}
              onChange={(value) => {
                setPlaying(undefined);
                setSearch(value);
              }}
              maxLength={100}
              className="flex-[1_1_100%] sm:flex-[0_1_240px]"
            />
          )}
          <ChoiceGroup
            legend={t('customer.history.filter')}
            hideLegend
            look="segmented"
            value={filter}
            onChange={(value) => {
              setPlaying(undefined);
              setFilter(value);
            }}
            options={(Object.keys(FILTERS) as Filter[]).map((value) => ({
              value,
              label: t(`customer.history.filters.${value}`),
            }))}
          />
        </div>
      }
    >
      {showsRecordings && recordingsError instanceof ApiError && recordingsError.status === 503 && (
        <p role="status" className="m-0 px-5 py-3 text-sm text-neutral lg:px-8">
          {t('customer.recordings.offline')}
        </p>
      )}
      {isPending ? (
        <SkeletonRows rows={4} />
      ) : timeline.length === 0 ? (
        <EmptyState>
          {t(
            q
              ? 'customer.history.emptySearch'
              : filter === 'all'
                ? 'customer.history.empty'
                : 'customer.history.emptyFilter',
          )}
        </EmptyState>
      ) : (
        <ol className="m-0 list-none p-0">
          {timeline.map((event) => {
            if (event.kind !== 'recording') return <EventRow key={event.id} event={event} />;

            const key = `${customer}:${event.id}`;
            return (
              <TimelineRow key={key} kind="call" at={event.at} title={t('customer.recordings.call')}>
                <span className="text-sm text-text-2">
                  {t('customer.recordings.duration', { seconds: f.number(event.duration) })}
                </span>
                <div>
                  <CallRecordingPlayer
                    customer={customer}
                    recording={event.id}
                    playing={playing === key}
                    onPlay={() => setPlaying(key)}
                  />
                </div>
              </TimelineRow>
            );
          })}
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
  const author = event.author ?? t('customer.history.system');
  // Django's history doesn't say who a lead went to.
  const session = event.kind === 'assign' && event.subject === 'consultation';
  const key =
    event.kind === 'lead' && !event.author
      ? 'leadNew'
      : session
        ? event.previous
          ? 'assignSession'
          : 'assignSessionFirst'
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
    <TimelineRow kind={event.kind} at={event.at} title={title}>
      {event.kind === 'assign' && event.reason !== undefined && (
        <p className="m-0 text-sm leading-7 text-neutral">
          {event.reason
            ? t('customer.history.reason', { reason: event.reason })
            : t('customer.history.noReason')}
          {event.note ? ` · ${event.note}` : ''}
        </p>
      )}
      {event.owner && (
        <span>
          <Chip tone="warn" small>
            {t('customer.history.otherSeller', { owner: event.owner })}
          </Chip>
        </span>
      )}
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
    </TimelineRow>
  );
}

function TimelineRow({
  kind,
  at,
  title,
  children,
}: {
  kind: HistoryKind;
  at: string;
  title: string;
  children: ReactNode;
}) {
  const f = useFormat();
  const look = LOOK[kind];
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
          <time dateTime={at} className="text-xs text-text-2">
            {f.timeAgo(at)}
          </time>
        </div>
        {children}
      </div>
    </li>
  );
}
