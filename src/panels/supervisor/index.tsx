import { ComingSoonPage } from '@/components/ComingSoonPage';
import {
  activityQuery,
  applicationsQuery,
  caseQuery,
  documentsQuery,
  inboxQuery,
  todayQuery,
} from '@/features/supervisor/api';
import { queryClient } from '@/lib/api/queryClient';
import { lazyPage } from '@/lib/router/lazyPage';
import { tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';

/** Start a page's request together with its chunk, not after it. A failure shows on the page. */
const prefetch = (load: () => Promise<unknown>) => () => {
  load().catch(() => undefined);
  return null;
};

/** The case of a `files/:id` route, or null for a bad id (the page says so). */
const caseIdOf = (params: { id?: string | undefined }) => {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Supervisors (executive team, or `can_manage_applicant`). Design: canvas "V1 · Supervisor panel"
 * (list, case file, applications) and V5 (today), built in the V6 look.
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
      loader: prefetch(() => queryClient.query(todayQuery)),
      ...lazyPage(() => import('@/features/supervisor/TodayPage'), ['supervisor']),
    },
    { path: 'files', ...lazyPage(() => import('@/features/supervisor/CasesPage'), ['supervisor']) },
    {
      path: 'files/:id',
      loader: ({ params }) => {
        const id = caseIdOf(params);
        if (id) queryClient.query(caseQuery(id)).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/supervisor/CaseLayout'), ['supervisor']),
      children: [
        { index: true, ...lazyPage(() => import('@/features/supervisor/CaseOverviewPage')) },
        {
          path: 'documents',
          loader: ({ params }) => {
            const id = caseIdOf(params);
            if (id) queryClient.query(documentsQuery(id)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/supervisor/CaseDocumentsPage')),
        },
        {
          path: 'applications',
          loader: ({ params }) => {
            const id = caseIdOf(params);
            if (id) queryClient.query(applicationsQuery(id)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/supervisor/CaseApplicationsPage')),
        },
        // One applicant's threads; `tickets/<thread>` for writing threads.
        { path: 'tickets/*', ...lazyPage(() => import('./CaseTicketsPage'), ['tickets']) },
        {
          path: 'activity',
          loader: ({ params }) => {
            const id = caseIdOf(params);
            if (id) queryClient.query(activityQuery(id, 1)).catch(() => undefined);
            return null;
          },
          ...lazyPage(() => import('@/features/supervisor/CaseActivityPage')),
        },
      ],
    },
    {
      path: 'tickets',
      loader: prefetch(() => queryClient.query(inboxQuery('waiting'))),
      ...lazyPage(() => import('@/features/supervisor/InboxPage'), ['supervisor']),
    },
    {
      path: 'tasks',
      loader: prefetch(() => queryClient.query(tasksQuery('supervisor'))),
      ...lazyPage(() => import('./TasksPage'), ['tasks']),
    },
    // No design yet.
    { path: 'reports', element: <ComingSoonPage title="panels.supervisor.nav.reports" /> },
  ],
};
