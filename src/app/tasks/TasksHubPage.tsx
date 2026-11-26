import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { NotificationsCard } from '@/features/account/components/NotificationsCard';
import { TasksPage } from '@/features/tasks/TasksPage';
import { unreadQuery } from '@/lib/account/api';
import { useSession } from '@/lib/auth/session';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { BoardPanel } from '@/lib/boards/api';
import { taskPanelsOf, type TasksPanel } from '@/lib/tasks/api';
import { useOpenTasks } from '@/lib/tasks/useOpenTasks';
import { PANELS } from '@/panels/registry';
import { TASK_CONTEXTS } from '@/panels/taskContexts';
import { hubPanelOf, INBOX_TABS, inboxHref, inboxTabOf, pillClass, type InboxTab } from './inbox';
import { TabCount } from './TabCount';

// «برد من»: only when its tab is opened.
const MyBoardView = lazy(() =>
  import('@/components/board/MyBoard').then((module) => ({ default: module.MyBoardView })),
);

type HubTab = InboxTab | 'board';

/** The hub's address for «برد من» of `panel`. */
const boardHref = (panel: BoardPanel) =>
  `/tasks?${new URLSearchParams({ tab: 'board', panel }).toString()}`;

const hrefOf = (tab: HubTab, panel: TasksPanel) =>
  tab === 'board' && panel !== 'staff'
    ? boardHref(panel)
    : inboxHref(tab === 'board' ? 'tasks' : tab, panel);

/**
 * /tasks: a staff member's tasks, notifications and own board («برد من», meeting0), one tab each
 * (tasks first), whatever panel they work in, and for staff without one (no board: it is a
 * panel's). `?panel=`: whose tasks (a panel the user has; the one they used last by default), with
 * a switch when they have several. `?tab=notifications|board`. `?view=` and `?day=` open a list or
 * a day, as on the panels' own tasks pages.
 */
export default function TasksHubPage() {
  const user = useSession();
  const [params] = useSearchParams();
  if (!user) return null;
  const panels = taskPanelsOf(user);
  const panel = hubPanelOf(user, params);
  const tab: HubTab =
    params.get('tab') === 'board' && panel !== 'staff' ? 'board' : inboxTabOf(params.get('tab'));
  const nav = <HubNav tab={tab} panel={panel} panels={panels} />;
  if (tab === 'board' && panel !== 'staff')
    return (
      <Suspense fallback={null}>
        <MyBoardView key={panel} panel={panel} top={nav} slots={TASK_CONTEXTS[panel].slots} />
      </Suspense>
    );
  if (tab === 'tasks') return <TasksPage key={panel} config={TASK_CONTEXTS[panel]} nav={nav} />;
  return <Notifications nav={nav} />;
}

/** The notifications tab: the account page's list (its card carries the heading). */
function Notifications({ nav }: { nav: ReactNode }) {
  const { t } = useTranslation('tasks');
  useDocumentTitle(t('hub.notifications'));
  return (
    <PageStack>
      {nav}
      <NotificationsCard />
    </PageStack>
  );
}

/** The tabs, and for tasks or the board whose panel they are (only for people with several). */
function HubNav({
  tab,
  panel,
  panels,
}: {
  tab: HubTab;
  panel: TasksPanel;
  panels: readonly TasksPanel[];
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const { count } = useOpenTasks(panel);
  const { data: unread = 0 } = useQuery(unreadQuery);
  const counts: Record<InboxTab, number> = { tasks: count, notifications: unread };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label={t('hub.tabs')}
        className="flex gap-1 rounded-full bg-surface p-1 shadow-panel"
      >
        {INBOX_TABS.map((value) => (
          <Link
            key={value}
            to={inboxHref(value, panel)}
            aria-current={tab === value ? 'page' : undefined}
            className={pillClass(tab === value)}
          >
            {t(value === 'tasks' ? 'hub.title' : 'hub.notifications')}
            <TabCount n={counts[value]} current={tab === value} />
          </Link>
        ))}
        {panel !== 'staff' && (
          <Link
            to={boardHref(panel)}
            aria-current={tab === 'board' ? 'page' : undefined}
            className={pillClass(tab === 'board')}
          >
            {t('board.title')}
          </Link>
        )}
      </nav>
      {tab !== 'notifications' && panels.length > 1 && (
        <nav
          aria-label={t('hub.context')}
          className="flex max-w-full gap-1 overflow-x-auto rounded-full p-1 shadow-[inset_0_0_0_1px_var(--line-2)]"
        >
          {panels.map((own) => {
            const name = PANELS.find((definition) => definition.id === own)?.name;
            return (
              <Link
                key={own}
                to={hrefOf(tab, own)}
                aria-current={own === panel ? 'page' : undefined}
                className={pillClass(own === panel)}
              >
                {name ? t(name, { ns: 'common' }) : own}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
