import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@/components/ui/BackLink';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { tasksQuery } from '@/lib/tasks/api';
import { MyTasks } from './components/MyTasks';
import { OnTime } from './components/OnTime';
import { Orphans } from './components/Orphans';
import { Requests } from './components/Requests';
import { SentCard, InternalRequestCard } from './components/SideCards';
import { TeamQueue } from './components/TeamQueue';
import { ViewTabs, type View } from './components/ViewTabs';
import type { TasksConfig } from './config';

/**
 * "Today's tasks": my follow-ups (nobody is left without a next step), colleagues' requests to
 * me, and my teams' queues. Tasks about a person are created on that person's page; this page is
 * for seeing and doing them. Canvas "پیگیری‌ها" / "کارها".
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
        actions={<OnTime onTime={data.on_time} />}
      />
      <ViewTabs
        value={view}
        onChange={setView}
        counts={{
          mine: data.mine.length,
          requests: data.requests.filter((item) => item.status !== 'done').length,
          team: data.team.filter((item) => item.taken === null).length,
        }}
      />
      {view === 'mine' && data.orphans.length > 0 && (
        <Orphans orphans={data.orphans} config={config} />
      )}
      <PageColumns
        asideLabel={t('aside')}
        main={
          view === 'mine' ? (
            <MyTasks data={data} config={config} />
          ) : view === 'requests' ? (
            <Requests requests={data.requests} config={config} />
          ) : (
            <TeamQueue items={data.team} config={config} />
          )
        }
        aside={
          <>
            <InternalRequestCard colleagues={data.colleagues} config={config} />
            <SentCard sent={data.sent} />
          </>
        }
      />
    </PageStack>
  );
}
