import {
  activityQuery,
  applicationsQuery,
  caseQuery,
  documentsQuery,
  inboxQuery,
  reportsQuery,
  todayQuery,
} from '@/features/supervisor/api';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';

/**
 * Supervisors (executive team, or `can_manage_applicant`). Design: canvas "V1 · Supervisor panel"
 * (list, case file, applications), V5 (today) and V8 (reports, CSV import), built in the V6 look.
 */
export const supervisorPanel: PanelDefinition = {
  id: 'supervisor',
  path: 'supervisor',
  name: 'panels.supervisor.name',
  description: 'panels.supervisor.description',
  icon: 'fileCheck',
  tone: 'primary',
  navLabel: 'panels.supervisor.nav.label',
  navigation: [
    {
      id: 'today',
      to: '',
      label: 'panels.supervisor.nav.today',
      tab: 'panels.supervisor.tabs.today',
      icon: 'home',
    },
    {
      id: 'files',
      to: 'files',
      label: 'panels.supervisor.nav.files',
      tab: 'panels.supervisor.tabs.files',
      icon: 'folder',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.supervisor.nav.tickets',
      tab: 'panels.supervisor.tabs.tickets',
      icon: 'chat',
    },
    {
      id: 'tasks',
      to: 'tasks',
      label: 'panels.supervisor.nav.tasks',
      tab: 'panels.supervisor.tabs.tasks',
      icon: 'check',
    },
    { id: 'reports', to: 'reports', label: 'panels.supervisor.nav.reports', icon: 'chart' },
  ],
  routes: [
    {
      index: true,
      ...lazyPage(
        () => import('@/features/supervisor/TodayPage'),
        ['supervisor'],
        () => [todayQuery],
      ),
    },
    { path: 'files', ...lazyPage(() => import('@/features/supervisor/CasesPage'), ['supervisor']) },
    {
      path: 'files/:id',
      ...lazyPage(
        () => import('@/features/supervisor/CaseLayout'),
        ['supervisor'],
        ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && caseQuery(id)];
        },
      ),
      children: [
        { index: true, ...lazyPage(() => import('@/features/supervisor/CaseOverviewPage')) },
        {
          path: 'documents',
          ...lazyPage(
            () => import('@/features/supervisor/CaseDocumentsPage'),
            [],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && documentsQuery(id)];
            },
          ),
        },
        {
          path: 'applications',
          ...lazyPage(
            () => import('@/features/supervisor/CaseApplicationsPage'),
            [],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && applicationsQuery(id)];
            },
          ),
        },
        // One applicant's threads; `tickets/<thread>` for writing threads.
        { path: 'tickets/*', ...lazyPage(() => import('./CaseTicketsPage'), ['tickets']) },
        {
          path: 'activity',
          ...lazyPage(
            () => import('@/features/supervisor/CaseActivityPage'),
            [],
            ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && activityQuery(id, 1)];
            },
          ),
        },
      ],
    },
    {
      path: 'tickets',
      ...lazyPage(
        () => import('@/features/supervisor/InboxPage'),
        ['supervisor'],
        () => [inboxQuery('waiting', 1)],
      ),
    },
    {
      path: 'tasks',
      ...lazyPage(
        () => import('./TasksPage'),
        ['tasks'],
        () => [tasksQuery('supervisor')],
      ),
    },
    {
      path: 'reports',
      ...lazyPage(
        () => import('@/features/supervisor/ReportsPage'),
        ['supervisor'],
        () => [reportsQuery('month')],
      ),
    },
  ],
};
