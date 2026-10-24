import { useTranslation } from 'react-i18next';
import { MessageBubble, MessageThread } from '@/components/tickets/MessageThread';
import { ThreadHeader } from '@/components/tickets/ThreadHeader';
import { Card } from '@/components/ui/Card';
import { useFormat } from '@/lib/i18n/useFormat';

const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

/**
 * A sample conversation with the case supervisors, for the locked preview (canvas V7 section 6).
 * Static blocks only: no requests, never anyone's real messages.
 */
export function TicketsPreview() {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const supervisor = t('preview.supervisor');
  const messages = [
    { id: 1, mine: true, text: t('preview.question'), sent: at(5) },
    { id: 2, mine: false, text: t('preview.answer'), sent: at(4) },
    { id: 3, mine: true, text: t('preview.thanks'), sent: at(3) },
  ];
  return (
    <Card aria-labelledby="tickets-preview-title" className="flex flex-col">
      <ThreadHeader
        id="tickets-preview-title"
        title={t('thread.supervisor.title')}
        subtitle={t('thread.supervisor.subtitle', { names: supervisor })}
        people={[supervisor]}
      />
      <MessageThread label={t('messages')} firstKey={1} lastKey={3} className="py-3">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            side={message.mine ? 'mine' : 'other'}
            author={message.mine ? t('you') : supervisor}
            avatarName={message.mine ? t('you') : supervisor}
            role={message.mine ? undefined : t('role.supervisor')}
            time={f.time(message.sent)}
            dateTime={message.sent}
            text={message.text}
            status={message.mine ? t('seen') : undefined}
          />
        ))}
      </MessageThread>
    </Card>
  );
}
