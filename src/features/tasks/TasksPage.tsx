import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { Card } from '@/components/ui/Card';
import { TagList } from '@/components/ui/Tags';
import { parseValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import {
  taskListQuery,
  tasksAddressOf,
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
  const f = useFormat();
  // The list and the day live in the address (`?view=`, `?day=`): the calendar's day row links here.
  const [params, setParams] = useSearchParams();
  const { view, day } = tasksAddressOf(params);
  const change = (key: 'view' | 'day', value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const setView = (value: View) => change('view', value === 'mine' ? null : value);
  // The team queue has no due day: it stays whole.
  const dayShown = view === 'team' ? null : day;
  const dayLabel = day && f.weekday(parseValue(day) ?? day);

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
      {dayLabel && dayShown && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-2">
          {t('day.showing')}
          <TagList
            label={t('day.label')}
            tags={[dayLabel]}
            latin={false}
            removeLabel={() => t('day.clear')}
            onRemove={() => change('day', null)}
          />
        </div>
      )}
      {view === 'mine' && data.orphans.length > 0 && (
        <Orphans orphans={data.orphans} config={config} />
      )}
      <PageColumns
        asideLabel={t('aside')}
        main={
          <TaskListView
            key={`${view}-${dayShown ?? ''}`}
            list={view}
            day={dayShown}
            overview={data}
            config={config}
          />
        }
        aside={<SentCard sent={data.sent} config={config} />}
      />
    </PageStack>
  );
}

/** One of the three lists, a page at a time (each tab starts again at page 1). */
function TaskListView({
  list,
  day,
  overview,
  config,
}: {
  list: TaskList;
  /** `YYYY-MM-DD`: only what's due that day. */
  day: string | null;
  overview: TasksOverview;
  config: TasksConfig;
}) {
  const { t } = useTranslation('tasks');
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(taskListQuery(config.panel, list, page, day));
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
      day={day}
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
