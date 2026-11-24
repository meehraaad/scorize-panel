import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageStack } from '@/components/ui/PageColumns';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CaseHero } from '@/features/supervisor/components/CaseHero';
import { CaseIdContext } from '@/features/supervisor/useCaseId';
import { useFormat } from '@/lib/i18n/useFormat';
import { idParam } from '@/lib/router/lazyPage';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { workspaceQuery, type CustomerWorkspace } from './api';
import { customerWorkspacePath } from './paths';
import { TaskCompleteButton } from './TaskCompleteButton';
import './workspace.css';

const TABS = [
  'desk',
  'tasks',
  'summary',
  'contract',
  'information',
  'documents',
  'reports',
] as const;

export default function CustomerWorkspaceLayout() {
  const id = idParam(useParams().id);
  return id === null ? <WorkspaceMissing /> : <LoadedWorkspace id={id} key={id} />;
}

function LoadedWorkspace({ id }: { id: number }) {
  const { data } = useSuspenseQuery(workspaceQuery(id));
  return data ? <WorkspaceFrame workspace={data} /> : <WorkspaceMissing />;
}

function WorkspaceMissing() {
  const { t } = useTranslation('executive');
  return (
    <EmptyState
      variant="card"
      title={t('workspace.missing')}
      action={
        <Link to="/executive/customers" className={buttonClass('outline')}>
          {t('customers.list')}
        </Link>
      }
    >
      {t('workspace.unavailable')}
    </EmptyState>
  );
}

function WorkspaceFrame({ workspace }: { workspace: CustomerWorkspace }) {
  const { t } = useTranslation('executive');
  const f = useFormat();
  const { id, name, case: file, next_task: next } = workspace;
  useDocumentTitle(name);

  return (
    <CaseIdContext value={file?.id ?? null}>
      <PageStack>
        <BackLink to="/executive/customers">{t('customers.list')}</BackLink>
        {file ? (
          <CaseHero data={file} appearance="executive" callLabel={t('workspace.call')}>
            {next && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl p-3 text-on-hero bg-luxe">
                <span className="text-on-luxe-gold flex size-11 items-center justify-center rounded-xl bg-luxe-gold">
                  <Icon name="clock" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-label text-on-hero-2">
                    {t('workspace.nextDue', { when: f.dateTime(next.due_at) })}
                  </div>
                  <div className="font-semibold wrap-anywhere">{next.text}</div>
                </div>
                <TaskCompleteButton workspace={workspace} task={next} onHero />
                <Link to={customerWorkspacePath(id, 'tasks')} className={buttonClass('onLuxe')}>
                  {t('workspace.myTasks', { n: f.number(workspace.open_tasks) })}
                </Link>
              </div>
            )}
          </CaseHero>
        ) : (
          <PageHeader title={name} />
        )}
        <nav className="customer-workspace-tabs" aria-label={t('workspace.navigation')}>
          {(file ? TABS : TABS.slice(0, 2)).map((tab) => {
            const count =
              tab === 'tasks'
                ? workspace.open_tasks
                : tab === 'documents'
                  ? file?.documents_waiting
                  : undefined;
            const path = customerWorkspacePath(id, tab);
            return (
              <NavLink key={tab} end={tab !== 'desk'} to={path} className="customer-workspace-tab">
                {t(`workspace.tab.${tab}`)}
                {!!count && <span className="text-label text-text-2">{f.number(count)}</span>}
              </NavLink>
            );
          })}
        </nav>
        <Suspense fallback={<PageSkeleton kind="tab" />}>
          <Outlet context={workspace} />
        </Suspense>
      </PageStack>
    </CaseIdContext>
  );
}
