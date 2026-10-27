import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@/components/ui/BackLink';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { Card } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import {
  taskListQuery,
  tasksQuery,
  type TaskList,
  type TaskListRow,
  type TasksOverview,
} from '@/lib/tasks/api';
import { MyTasks } from './components/MyTasks';
import { OnTime } from './components/OnTime';
import { Orphans } from './components/Orphans';
import { Requests } from './components/Requests';
import { NewTaskButton } from './components/NewTask';
import { SentCard } from './components/SideCards';
import { TeamQueue } from './components/TeamQueue';
import { ViewTabs, type View } from './components/ViewTabs';
import type { TasksConfig } from './config';

/**
 * "Today's tasks": my follow-ups (nobody is left without a next step), colleagues' requests to
 * me, and my teams' queues. Tasks about a person are created on that person's page; «کار تازه»
 * here makes one about nobody, for me, colleagues or a team. Canvas "پیگیری‌ها" / "کارها".
 */
export function TasksPage({ config }: { config: TasksConfig }) {
  const { t } = useTranslation('tasks');
  const { data } = useSuspenseQuery(tasksQuery(config.panel));
  const [view, setView] = useState<View>('mine');

  return (
    <PageStack>
      <BackLink to={config.homePath}>{t('back')}</BackLink>
      <PageHeader
        title={t('title')}
        subtitle={t(`subtitle.${config.person}`)}
        actions={
          <>
            {data.on_time && <OnTime onTime={data.on_time} />}
            <NewTaskButton colleagues={data.colleagues} />
          </>
        }
      />
      <ViewTabs value={view} onChange={setView} counts={data.counts} />
      {view === 'mine' && data.orphans.length > 0 && (
        <Orphans orphans={data.orphans} config={config} />
      )}
      <PageColumns
        asideLabel={t('aside')}
        main={<TaskListView key={view} list={view} overview={data} config={config} />}
        aside={<SentCard sent={data.sent} config={config} />}
      />
    </PageStack>
  );
}

/** One of the three lists, a page at a time (each tab starts again at page 1). */
function TaskListView({
  list,
  overview,
  config,
}: {
  list: TaskList;
  overview: TasksOverview;
  config: TasksConfig;
}) {
  const { t } = useTranslation('tasks');
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(taskListQuery(config.panel, list, page));
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);

  if (!data)
    return (
      <Card aria-label={t(`view.${list}.label`)}>
        <SkeletonRows rows={4} />
      </Card>
    );
  const pager: ReactNode = pages > 1 && (
    <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
  );
  const rows = data.results;
  return list === 'mine' ? (
    <MyTasks
      tasks={rows as TaskListRow['mine'][]}
      tomorrow={overview.tomorrow}
      doneToday={overview.done_today}
      pager={pager}
      config={config}
    />
  ) : list === 'requests' ? (
    <Requests requests={rows as TaskListRow['requests'][]} pager={pager} config={config} />
  ) : (
    <TeamQueue items={rows as TaskListRow['team'][]} pager={pager} config={config} />
  );
}
