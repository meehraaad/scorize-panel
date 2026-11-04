import {
  activityQuery,
  applicationsQuery,
  caseQuery,
  caseTickets,
  casesQuery,
  documentsQuery,
  firstCasesQuery,
  handoffsQuery,
  inboxQuery,
  reportsQuery,
  todayBoardQuery,
  todayCountsQuery,
  todayWaitingQuery,
} from '@/features/supervisor/api';
import { prefetchTickets } from '@/features/tickets/config';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { taskListQuery, tasksQuery } from '@/lib/tasks/api';
import { ASSIGN_PERMISSION } from '@/features/supervisor/api';
import {
  botRulesQuery,
  MAIL_PERMISSION,
  mailboxesQuery,
  FIRST_MAILBOXES,
  serversQuery,
} from '@/features/mail/api';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { redirect } from 'react-router';
import type { PanelDefinition } from '../types';

/** Supervisors who don't assign new cases are sent back to the panel's home. */
async function assignersOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return user && hasPermission(user, ASSIGN_PERMISSION) ? null : redirect('/supervisor');
}

/** The mail page is for managers with `mail_server.manage_mailboxes`, once Django serves it. */
async function mailManagersOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return ON_SERVER.mailServers && user && hasPermission(user, MAIL_PERMISSION)
    ? null
    : redirect('/supervisor');
}

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
    {
      id: 'new',
      to: 'new',
      label: 'panels.supervisor.nav.new',
      icon: 'user',
      permission: ASSIGN_PERMISSION,
    },
    { id: 'reports', to: 'reports', label: 'panels.supervisor.nav.reports', icon: 'chart' },
    ...(ON_SERVER.mailServers
      ? [
          {
            id: 'mail',
            to: 'mail',
            label: 'panels.supervisor.nav.mail',
            icon: 'mail',
            permission: MAIL_PERMISSION,
          } as const,
        ]
      : []),
  ],
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/supervisor/TodayPage'), ['supervisor'], {
        data: () => [todayBoardQuery(1), todayWaitingQuery(1), todayCountsQuery],
        skeleton: 'dashboard',
      }),
    },
    {
      path: 'files',
      ...lazyPage(() => import('@/features/supervisor/CasesPage'), ['supervisor'], {
        data: ({ request }) => [casesQuery(firstCasesQuery(new URL(request.url).searchParams))],
        skeleton: 'list',
      }),
    },
    {
      path: 'files/:id',
      ...lazyPage(() => import('@/features/supervisor/CaseLayout'), ['supervisor'], {
        data: ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && caseQuery(id)];
        },
        skeleton: 'detail',
      }),
      children: [
        { index: true, ...lazyPage(() => import('@/features/supervisor/CaseOverviewPage')) },
        {
          path: 'documents',
          ...lazyPage(() => import('@/features/supervisor/CaseDocumentsPage'), [], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && documentsQuery(id)];
            },
          }),
        },
        {
          path: 'applications',
          ...lazyPage(() => import('@/features/supervisor/CaseApplicationsPage'), [], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && applicationsQuery(id)];
            },
          }),
        },
        // One applicant's threads; `tickets/<thread>` for writing threads.
        {
          path: 'tickets/*',
          loader: ({ params }) => {
            const id = idParam(params.id);
            if (id !== null) prefetchTickets(caseTickets(id), params['*'] ?? '');
            return null;
          },
          ...lazyPage(() => import('./CaseTicketsPage'), ['tickets']),
        },
        {
          path: 'activity',
          ...lazyPage(() => import('@/features/supervisor/CaseActivityPage'), [], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [id !== null && activityQuery(id, 1)];
            },
          }),
        },
      ],
    },
    {
      path: 'tickets',
      ...lazyPage(() => import('@/features/supervisor/InboxPage'), ['supervisor'], {
        data: () => [inboxQuery('waiting', 1)],
        skeleton: 'list',
      }),
    },
    {
      path: 'tasks',
      ...lazyPage(() => import('./TasksPage'), ['tasks'], {
        data: () => [tasksQuery('supervisor'), taskListQuery('supervisor', 'mine', 1)],
        skeleton: 'list',
      }),
    },
    // New cases waiting for a supervisor (managers with can_assign_supervisor).
    {
      path: 'new',
      ...lazyPage(() => import('@/features/supervisor/HandoffsPage'), ['supervisor'], {
        guard: assignersOnly,
        data: () => [handoffsQuery],
        skeleton: 'list',
      }),
    },
    {
      path: 'reports',
      ...lazyPage(() => import('@/features/supervisor/ReportsPage'), ['supervisor'], {
        data: () => [reportsQuery('month')],
        skeleton: 'dashboard',
      }),
    },
    // Our mail servers and the applicants' mailboxes (managers with manage_mailboxes).
    {
      path: 'mail',
      ...lazyPage(() => import('@/features/mail/MailPage'), ['mail'], {
        guard: mailManagersOnly,
        data: () => [serversQuery, botRulesQuery, mailboxesQuery(FIRST_MAILBOXES)],
        skeleton: 'list',
      }),
    },
  ],
};
