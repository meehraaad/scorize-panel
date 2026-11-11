import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ThreadMessages } from '@/components/tickets/ThreadMessages';
import { ThreadTabs } from '@/components/tickets/ThreadTabs';
import { TicketComposer } from '@/components/tickets/TicketComposer';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingPanel } from '@/components/ui/FloatingPanel';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { Badge } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  activateCaseChat,
  closeCaseChat,
  restoreCaseChats,
  setCaseChatDraft,
  setCaseChatThread,
  useCaseChats,
  type CaseChat,
} from '@/lib/supervisor/caseChats';
import {
  ticketsQuery,
  useMarkSeen,
  type TicketThread,
  type TicketsConfig,
} from '@/lib/tickets/api';
import { caseTickets } from '../api';
import { casePath } from '../paths';

/** While a window is open, its messages refresh this often (Django has no push yet). */
const LIVE_MS = 15_000;
/** Minimized windows refresh their unread count this often. */
const TRAY_MS = 60_000;

const ICON_BUTTON =
  'inline-flex size-11 flex-none items-center justify-center rounded-full text-text-2 hover:bg-canvas';

const staffConfig = (id: number, customer?: string): TicketsConfig => ({
  ...caseTickets(id),
  path: casePath(id),
  viewer: 'staff',
  customer,
  caseId: id,
});

const unreadOf = (threads: readonly TicketThread[] | undefined) =>
  (threads ?? []).reduce((sum, thread) => sum + thread.unread, 0);

/**
 * The supervisor's chats with applicants, over every page of the panel: the open one in a
 * floating window, the others minimized at the bottom with their unread count and unsent text.
 * Design: canvas "Supervisor chat popup".
 */
export default function CaseChatDock({ owner }: { owner: number }) {
  const { t } = useTranslation('supervisor');
  const { owner: restored, chats, active } = useCaseChats();
  // This tab's windows come back minimized once the account is known.
  useEffect(() => {
    restoreCaseChats(owner);
  }, [owner]);
  if (restored !== owner || chats.length === 0) return null;
  const current = chats.find((chat) => chat.case === active);
  const waiting = chats.filter((chat) => chat.case !== active);
  return (
    <>
      {current && <ChatWindow key={current.case} chat={current} />}
      {waiting.length > 0 && (
        <aside
          aria-label={t('chat.tray')}
          className={`fixed start-3 end-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex max-h-32 flex-wrap justify-end gap-2 overflow-y-auto lg:start-auto lg:bottom-5 lg:max-w-[50vw] ${
            current ? 'max-lg:hidden lg:end-[456px]' : 'lg:end-5'
          }`}
        >
          {waiting.map((chat) => (
            <TrayChip key={chat.case} chat={chat} />
          ))}
        </aside>
      )}
    </>
  );
}

function TrayChip({ chat }: { chat: CaseChat }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const config = useMemo(() => staffConfig(chat.case), [chat.case]);
  const { data } = useQuery({ ...ticketsQuery(config), refetchInterval: TRAY_MS });
  const unread = unreadOf(data?.threads);
  const label = [
    t('chat.resume', { name: chat.name }),
    unread > 0 ? t('chat.unread', { n: f.number(unread) }) : '',
    chat.draft.trim() ? t('chat.draft') : '',
  ]
    .filter(Boolean)
    .join('، ');
  return (
    <Button
      variant="outline"
      onClick={() => activateCaseChat(chat.case)}
      aria-label={label}
      className="max-w-full bg-surface ps-1.5 shadow-panel"
    >
      <Avatar name={chat.name} size="sm" />
      <span className="truncate">{chat.name}</span>
      {unread > 0 && <Badge>{f.number(unread)}</Badge>}
      {chat.draft.trim() && (
        <Chip tone="warn" small>
          {t('chat.draft')}
        </Chip>
      )}
    </Button>
  );
}

function ChatWindow({ chat }: { chat: CaseChat }) {
  const { t } = useTranslation('supervisor');
  const { t: tt } = useTranslation('tickets');
  const config = useMemo(() => staffConfig(chat.case, chat.name), [chat.case, chat.name]);
  const overview = useQuery({ ...ticketsQuery(config), refetchInterval: LIVE_MS });
  const threads = overview.data?.threads ?? [];
  // An old address may name a department ('writing') instead of a thread.
  const thread =
    threads.find((item) => item.id === chat.thread) ??
    threads.find((item) => item.department === chat.thread) ??
    threads[0];
  const subtitle = thread
    ? thread.writing
      ? tt('thread.writing.title', { department: tt(`writing.${thread.writing}`) })
      : tt('thread.supervisor.title')
    : undefined;

  return (
    <FloatingPanel
      variant="chat"
      title={chat.name}
      subtitle={subtitle}
      closeLabel={t('chat.minimize')}
      onClose={() => activateCaseChat(null)}
      actions={
        <>
          <Link
            to={casePath(chat.case)}
            aria-label={t('chat.openCase', { name: chat.name })}
            title={t('chat.openCase', { name: chat.name })}
            className={ICON_BUTTON}
          >
            <Icon name="folder" size={20} />
          </Link>
          <button
            type="button"
            onClick={() => closeCaseChat(chat.case)}
            aria-label={t('chat.close')}
            title={t('chat.close')}
            className={ICON_BUTTON}
          >
            <Icon name="close" size={20} />
          </button>
        </>
      }
    >
      {overview.isError && !overview.data ? (
        <div className="p-5">
          <Notice tone="info">
            <p className="m-0">{t('chat.error')}</p>
            <Button variant="outline" onClick={() => void overview.refetch()}>
              {t('chat.retry')}
            </Button>
          </Notice>
        </div>
      ) : overview.data === undefined ? (
        <div aria-busy="true" className="py-3">
          <SkeletonRows rows={4} />
        </div>
      ) : !thread ? (
        <div className="p-5">
          <EmptyState>{tt('noThreads')}</EmptyState>
        </div>
      ) : (
        <ChatThread key={thread.id} config={config} chat={chat} threads={threads} thread={thread} />
      )}
    </FloatingPanel>
  );
}

function ChatThread({
  config,
  chat,
  threads,
  thread,
}: {
  config: TicketsConfig;
  chat: CaseChat;
  threads: readonly TicketThread[];
  thread: TicketThread;
}) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const { mutate: markSeen } = useMarkSeen(config, thread.id);
  const hasUnread = thread.unread > 0;

  // The open window reads the applicant's messages, also those arriving while it stays open.
  useEffect(() => {
    if (hasUnread) markSeen();
  }, [hasUnread, markSeen]);

  const tabs = threads.map((item) => ({
    key: item.id,
    label: item.writing ? t(`writing.${item.writing}`) : t(`department.${item.department}`),
    onSelect: () => setCaseChatThread(chat.case, item.id),
    active: item.id === thread.id,
    badge: item.id !== thread.id && item.unread > 0 ? f.number(item.unread) : undefined,
  }));

  return (
    <>
      {tabs.length > 1 && <ThreadTabs compact label={t('departments')} items={tabs} />}
      <Suspense
        fallback={
          <div aria-busy="true" className="min-h-0 flex-1 py-3">
            <SkeletonRows rows={3} />
          </div>
        }
      >
        <ThreadMessages config={config} thread={thread.id} compact refetchInterval={LIVE_MS} />
      </Suspense>
      <TicketComposer
        config={config}
        thread={thread.id}
        compact
        initialText={chat.draft}
        onTextChange={(text) => setCaseChatDraft(chat.case, text)}
      />
    </>
  );
}
