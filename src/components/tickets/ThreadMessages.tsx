import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DaySeparator, MessageBubble, MessageThread } from '@/components/tickets/MessageThread';
import { TicketRating } from '@/components/tickets/TicketRating';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  URGENT,
  messagesOf,
  messagesQuery,
  useRateMessage,
  type TicketMessage,
} from '@/lib/tickets/api';
import { daysAgo, withDays } from '@/lib/tickets/thread';
import type { TicketsConfig } from '@/lib/tickets/api';

const MAX_RATING = 5;

/** The thread's messages, oldest first, by day; earlier pages load on request. */
export function ThreadMessages({ config, thread }: { config: TicketsConfig; thread: string }) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    messagesQuery(config, thread),
  );
  const rate = useRateMessage(config, thread);
  const messages = messagesOf(data.pages);

  if (messages.length === 0)
    return (
      <div className="min-h-0 flex-1">
        <EmptyState
          variant="padded"
          title={t(config.viewer === 'staff' ? 'staffEmptyTitle' : 'emptyTitle')}
          icon="chat"
          action={
            <Button
              variant="outline"
              onClick={() =>
                document.getElementById(`ticket-${thread.replace('/', '-')}-text`)?.focus()
              }
            >
              {t('writeFirst')}
            </Button>
          }
        >
          {t(config.viewer === 'staff' ? 'staffEmpty' : 'empty')}
        </EmptyState>
      </div>
    );

  const dayLabel = (value: string) => {
    const days = daysAgo(value);
    return days === 0 ? t('today') : days === 1 ? t('yesterday') : f.weekday(value);
  };

  return (
    <MessageThread
      label={t('messages')}
      firstKey={messages[0]?.id}
      lastKey={messages.at(-1)?.id}
      className="px-3.5 py-[18px] lg:px-7 lg:py-6"
      earlier={
        hasNextPage
          ? {
              label: t('earlier'),
              pending: isFetchingNextPage,
              onClick: () => void fetchNextPage(),
            }
          : null
      }
    >
      {withDays(messages).map((item) =>
        item.kind === 'day' ? (
          <DaySeparator key={item.key}>{dayLabel(item.date)}</DaySeparator>
        ) : (
          <Message
            key={item.key}
            message={item.message}
            canRate={config.viewer === 'applicant'}
            rating={rate.isPending}
            onRate={(score) => rate.mutate({ id: item.message.id, score })}
          />
        ),
      )}
    </MessageThread>
  );
}

function Message({
  message,
  canRate,
  rating,
  onRate,
}: {
  message: TicketMessage;
  canRate: boolean;
  rating: boolean;
  onRate: (score: number) => void;
}) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const { mine, auto } = message;
  const max = f.number(MAX_RATING);
  const tag = auto
    ? { label: t('tag.auto'), tone: 'neutral' as const }
    : message.priority === URGENT
      ? { label: t('tag.urgent'), tone: 'warn' as const }
      : undefined;

  return (
    <MessageBubble
      side={mine ? 'mine' : 'other'}
      author={mine ? t('you') : message.author}
      avatarName={message.author}
      role={!mine && message.role ? t(`role.${message.role}`) : undefined}
      tag={tag}
      time={f.time(message.sent_at)}
      dateTime={message.sent_at}
      text={message.text}
      outlined={auto}
      attachment={message.attachment}
      status={mine ? (message.seen ? t('seen') : t('sent')) : undefined}
      footer={
        // Under staff replies: the applicant rates them; staff see the score given.
        message.role !== null &&
        !auto && (
          <TicketRating
            value={message.rating}
            max={MAX_RATING}
            prompt={t('rate')}
            ratedLabel={
              message.rating === null
                ? ''
                : t(canRate ? 'rated' : 'ratedByApplicant', { n: f.number(message.rating), max })
            }
            starLabel={(score) => t('star', { n: f.number(score), max })}
            disabled={rating}
            onRate={canRate ? onRate : undefined}
          />
        )
      }
    />
  );
}
