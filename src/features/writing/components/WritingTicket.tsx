import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketComposer } from '@/components/tickets/TicketComposer';
import { ThreadMessages } from '@/components/tickets/ThreadMessages';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { applicantTickets, writingThread } from '@/lib/applicant/tickets';
import { useFormat } from '@/lib/i18n/useFormat';
import { ticketsQuery, useMarkSeen, type TicketThread } from '@/lib/tickets/api';
import type { FormType } from '../formSpec';

/**
 * Opens the form's writing ticket over the form, on its own department (the SOP form talks to the
 * SOP writer), so nothing typed is left behind. A contract with writing or a paid writing order has
 * the thread; before that the dialog says when tickets open.
 */
export function WritingTicketButton({
  type,
  className,
  children,
}: {
  type: FormType;
  className: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('tickets');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('thread.writing.title', { department: t(`writing.${type}`) })}
        closeLabel={t('close')}
      >
        <Suspense fallback={<SkeletonRows rows={3} />}>
          <WritingTicketBody type={type} />
        </Suspense>
      </Dialog>
    </>
  );
}

function WritingTicketBody({ type }: { type: FormType }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(ticketsQuery(applicantTickets));
  const thread = data?.threads.find((item) => item.id === writingThread(type));

  if (!thread)
    return (
      <EmptyState title={t('lock.tickets.title')} icon="chat">
        {t('lock.tickets.text')}
      </EmptyState>
    );
  return <Conversation thread={thread} />;
}

function Conversation({ thread }: { thread: TicketThread }) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const { mutate: markSeen } = useMarkSeen(applicantTickets, thread.id);
  const hasUnread = thread.unread > 0;

  // Opening the thread reads the writer's messages (Ticket.is_seen), as on the tickets page.
  useEffect(() => {
    if (hasUnread) markSeen();
  }, [hasUnread, markSeen]);

  const names = f.list(thread.team.map((member) => member.name));
  return (
    // The chat fills the dialog: only the messages scroll; the composer stays at the bottom.
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="m-0 pb-2 text-sm leading-6 text-text-2">
        {thread.team.length > 0
          ? t('thread.writing.subtitle', { names })
          : t('thread.writing.noTeam')}
      </p>
      <Suspense
        fallback={
          <div aria-busy="true" className="min-h-0 flex-1 py-3">
            <SkeletonRows rows={3} />
          </div>
        }
      >
        <ThreadMessages config={applicantTickets} thread={thread.id} />
      </Suspense>
      <TicketComposer config={applicantTickets} thread={thread.id} />
    </div>
  );
}
