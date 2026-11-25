import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { NewTaskButton } from '@/components/tasks/NewTask';
import { buttonClass } from '@/components/ui/buttonStyles';
import { NotificationPeek } from '@/features/account/components/NotificationPeek';
import { TaskPeek } from '@/features/tasks/components/TaskPeek';
import { unreadQuery } from '@/lib/account/api';
import { tasksQuery, type TasksPanel } from '@/lib/tasks/api';
import { useOpenTasks } from '@/lib/tasks/useOpenTasks';
import { TASK_CONTEXTS } from '@/panels/taskContexts';
import { INBOX_TABS, inboxHref, pillClass, type InboxTab } from './inbox';
import { TabCount } from './TabCount';

/**
 * The bell's popup for staff: what is waiting (tasks first) and the newest notifications, a tab
 * each, with the way to the whole page and a new task. Loaded when the bell is first opened.
 */
export default function BellPopover({ panel }: { panel: TasksPanel }) {
  const { t } = useTranslation('tasks');
  const [tab, setTab] = useState<InboxTab>('tasks');
  const { count } = useOpenTasks(panel);
  const { data: unread = 0 } = useQuery(unreadQuery);
  const overview = useQuery({ ...tasksQuery(panel), enabled: tab === 'tasks' });
  const counts: Record<InboxTab, number> = { tasks: count, notifications: unread };

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div
          role="group"
          aria-label={t('hub.tabs')}
          className="flex gap-1 rounded-full bg-canvas p-1"
        >
          {INBOX_TABS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={pillClass(tab === value)}
            >
              {t(value === 'tasks' ? 'hub.title' : 'hub.notifications')}
              <TabCount n={counts[value]} current={tab === value} />
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[min(28rem,calc(100dvh-14rem))] overflow-y-auto overscroll-contain pb-2">
        {tab === 'tasks' ? <TaskPeek config={TASK_CONTEXTS[panel]} /> : <NotificationPeek />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 shadow-[inset_0_1px_0_var(--hair)]">
        <Link to={inboxHref(tab, panel)} className={buttonClass('quiet')}>
          {t(tab === 'tasks' ? 'hub.all' : 'hub.allNotifications')}
        </Link>
        {tab === 'tasks' && overview.data && (
          <NewTaskButton colleagues={overview.data.colleagues} />
        )}
      </div>
    </>
  );
}
