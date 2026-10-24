import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MessageBubble } from '@/components/tickets/MessageThread';
import { TicketRating } from '@/components/tickets/TicketRating';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge, SectionCard } from '@/components/ui/SectionCard';
import { APPLICANT_TICKETS, SUPERVISOR_THREAD } from '@/lib/applicant/tickets';
import { useFormat } from '@/lib/i18n/useFormat';
import { DEFAULT_PRIORITY, useRateMessage, useSendMessage } from '@/lib/tickets/api';
import type { ApplicantOverview, TicketMessage } from '../api';
import { toast } from '@/lib/toast';

const MAX_RATING = 5;

/** Latest messages of the supervisors' thread, with a quick reply. The full thread is /tickets. */
export function TicketCard({ ticket }: { ticket: ApplicantOverview['ticket'] }) {
  const { t } = useTranslation('home');
  const f = useFormat();

  return (
    <SectionCard
      id="home-ticket"
      title={t('ticket.title')}
      badge={
        ticket &&
        ticket.unread > 0 && <Badge>{t('ticket.new', { n: f.number(ticket.unread) })}</Badge>
      }
      end={
        <Link
          to="/tickets"
          className="flex-none text-sm font-medium whitespace-nowrap text-primary-text"
        >
          {t('ticket.all')}
        </Link>
      }
    >
      {ticket && ticket.messages.length > 0 ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-3.5 px-5 pt-2 pb-5 lg:px-8 lg:pb-6">
            {ticket.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </ul>
          <ReplyForm messages={ticket.messages} />
        </>
      ) : (
        <EmptyState>{t('ticket.empty')}</EmptyState>
      )}
    </SectionCard>
  );
}

function Message({ message }: { message: TicketMessage }) {
  const { t } = useTranslation('home');
  const f = useFormat();
  const rate = useRateMessage(APPLICANT_TICKETS, SUPERVISOR_THREAD);
  const { mine } = message;
  const max = f.number(MAX_RATING);

  return (
    <MessageBubble
      compact
      side={mine ? 'mine' : 'other'}
      author={mine ? t('ticket.you') : message.author}
      avatarName={message.author}
      role={message.role ? t(`role.${message.role}`) : undefined}
      time={f.timeAgo(message.sent_at)}
      dateTime={message.sent_at}
      text={message.text}
      outlined={message.auto}
      attachment={message.attachment}
      status={!mine && !message.seen && t('ticket.unread')}
      footer={
        !mine &&
        !message.auto && (
          <TicketRating
            value={message.rating}
            max={MAX_RATING}
            prompt={t('ticket.rate')}
            ratedLabel={
              message.rating === null ? '' : t('ticket.rated', { n: f.number(message.rating), max })
            }
            starLabel={(score) => t('ticket.star', { n: f.number(score), max })}
            disabled={rate.isPending}
            onRate={(score) => rate.mutate({ id: message.id, score })}
          />
        )
      }
    />
  );
}

function ReplyForm({ messages }: { messages: TicketMessage[] }) {
  const { t } = useTranslation('home');
  const reply = useSendMessage(APPLICANT_TICKETS, SUPERVISOR_THREAD);
  const [text, setText] = useState('');
  // Reply to whoever on the team wrote last.
  const name = messages.findLast((message) => !message.mine)?.author ?? t('team.title');

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    reply.mutate(
      { text: text.trim(), priority: DEFAULT_PRIORITY, attachment: null },
      { onError: () => toast.error(t('ticket.sendError')), onSuccess: () => setText('') },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 px-4 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-4"
    >
      <div className="flex items-center gap-2">
        <label htmlFor="home-reply" className="sr-only">
          {t('ticket.replyLabel', { name })}
        </label>
        <input
          id="home-reply"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('ticket.replyPlaceholder', { name })}
          className="h-11 min-w-0 flex-1 rounded-full bg-canvas px-[18px] text-[15px] text-text outline-0 placeholder:text-text-2 focus-visible:outline-2"
        />
        <Button type="submit" disabled={reply.isPending} className="flex-none">
          {t('ticket.send')}
        </Button>
      </div>
    </form>
  );
}
