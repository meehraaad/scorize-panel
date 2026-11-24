import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { NewTaskDialog } from '@/features/supervisor/components/NewTaskDialog';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  customerTasksQuery,
  useRefreshCustomerWorkspace,
  type CustomerWorkspace,
  type TaskState,
} from './api';
import { TaskCompleteButton } from './TaskCompleteButton';

export default function CustomerTasksPage() {
  const { t } = useTranslation('executive');
  const f = useFormat();
  const workspace = useOutletContext<CustomerWorkspace>();
  const [state, setState] = useState<TaskState>('open');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const refresh = useRefreshCustomerWorkspace(workspace.id, workspace.case?.id);
  const { data, isPlaceholderData, error } = useQuery(
    customerTasksQuery(workspace.id, state, page),
  );
  if (error && !data) throw error;
  return (
    <PageStack>
      <SectionCard
        id="customer-tasks"
        title={t('workspace.tab.tasks')}
        end={
          workspace.case && (
            <Button variant="outline" onClick={() => setCreating(true)}>
              {t('workspace.newTask')}
            </Button>
          )
        }
      >
        <div className="px-5 pb-3">
          <FilterTabs<TaskState>
            label={t('workspace.tab.tasks')}
            value={state}
            options={[
              {
                value: 'open',
                label: t('workspace.openTasks'),
                ...(data && { count: f.number(data.open) }),
              },
              {
                value: 'completed',
                label: t('workspace.completedTasks'),
                ...(data && { count: f.number(data.completed) }),
              },
            ]}
            onChange={(next) => {
              setState(next);
              setPage(1);
            }}
          />
        </div>
        {!data || isPlaceholderData ? (
          <SkeletonRows rows={4} />
        ) : data.results.length ? (
          <ul className="m-0 list-none divide-y divide-hair p-0">
            {data.results.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <div className="font-semibold wrap-anywhere">{task.text}</div>
                  <time className="text-label text-text-2" dateTime={task.done_at ?? task.due_at}>
                    {f.dateTime(task.done_at ?? task.due_at)}
                  </time>
                </div>
                <TaskCompleteButton workspace={workspace} task={task} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t('workspace.noTasks')}</EmptyState>
        )}
        {data && pagesOf(data) > 1 && (
          <Pager page={page} pages={pagesOf(data)} onPage={setPage} pending={isPlaceholderData} />
        )}
      </SectionCard>
      {workspace.case && creating && (
        <NewTaskDialog
          caseId={workspace.case.id}
          user={workspace.id}
          name={workspace.name}
          open
          onClose={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
    </PageStack>
  );
}
