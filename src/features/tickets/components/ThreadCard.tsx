import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThreadHeader } from '@/components/tickets/ThreadHeader';
import { ThreadTabs } from '@/components/tickets/ThreadTabs';
import { Card } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { serviceLabel, useMarkSeen, type TicketThread } from '@/lib/tickets/api';
import { threadPath, type TicketsConfig } from '../config';
import { ThreadMessages } from '@/components/tickets/ThreadMessages';
import { TicketComposer } from '@/components/tickets/TicketComposer';

const TITLE_ID = 'ticket-thread-title';

/** The open conversation: who answers, the department's tabs, the messages and the composer. */
export function ThreadCard({
  config,
  threads,
  thread,
}: {
  config: TicketsConfig;
  threads: readonly TicketThread[];
  thread: TicketThread;
}) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const { mutate: markSeen } = useMarkSeen(config, thread.id);
  const hasUnread = thread.unread > 0;

  // Opening the thread reads the other side's messages (Ticket.is_seen).
  useEffect(() => {
    if (hasUnread) markSeen();
  }, [hasUnread, markSeen]);

  const department = thread.writing ? t(`writing.${thread.writing}`) : '';
  const names = f.list(thread.team.map((member) => member.name));
  const service = thread.service ?? null;
  // A service's conversation (SVC3) reads as its own kind of thread; the others by department.
  const kind = service ? 'service' : thread.department;
  const title =
    thread.department === 'writing'
      ? t('thread.writing.title', { department })
      : service
        ? t('thread.service.title', { service: serviceLabel(service) })
        : t('thread.supervisor.title');
  const subtitle =
    config.viewer === 'staff'
      ? t(`thread.${kind}.staffSubtitle`, { names })
      : thread.team.length > 0
        ? t(`thread.${kind}.subtitle`, { names })
        : t(`thread.${kind}.noTeam`);

  // Tabs inside a department: the writing departments, or the general conversation and the
  // services' (only when the case has services).
  const siblings = threads.filter((item) =>
    thread.department === 'writing'
      ? item.department === 'writing' && item.writing
      : item.department === 'supervisor',
  );
  const tabbed = thread.department === 'writing' || siblings.some((item) => item.service);
  const tabs = siblings.map((item) => ({
    key: item.id,
    label: item.writing
      ? t(`writing.${item.writing}`)
      : item.service
        ? serviceLabel(item.service)
        : t('generalTab'),
    to: threadPath(config, threads, item),
    active: item.id === thread.id,
    badge: item.id !== thread.id && item.unread > 0 ? f.number(item.unread) : undefined,
  }));

  return (
    // A chat window: only the messages scroll; the composer stays at the bottom. Phones: fills the
    // page (PageFill). From lg: as tall as the screen below the page title.
    <Card
      aria-labelledby={TITLE_ID}
      className="flex flex-col max-lg:min-h-0 max-lg:flex-1 lg:h-[calc(100dvh-var(--panel-top)-190px)] lg:min-h-[560px]"
    >
      <ThreadHeader
        id={TITLE_ID}
        title={title}
        subtitle={subtitle}
        people={thread.team.map((member) => member.name)}
      />
      {tabbed && tabs.length > 0 && (
        <ThreadTabs
          label={t(thread.department === 'writing' ? 'writingTabs' : 'serviceTabs')}
          lead={t(thread.department === 'writing' ? 'writingLead' : 'serviceLead')}
          items={tabs}
        />
      )}
      <Suspense
        fallback={
          <div aria-busy="true" className="min-h-0 flex-1 py-3">
            <SkeletonRows rows={3} />
          </div>
        }
      >
        <ThreadMessages config={config} thread={thread.id} />
      </Suspense>
      {service?.status === 'closed' ? (
        <p className="m-0 px-5 py-4 text-sm leading-6 text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-7">
          {t('thread.service.closed')}
        </p>
      ) : (
        <TicketComposer config={config} thread={thread.id} />
      )}
    </Card>
  );
}
