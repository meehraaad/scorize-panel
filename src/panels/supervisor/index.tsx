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
  managerTeamQuery,
  myServicesQuery,
  scopesQuery,
  servicesReportQuery,
  serviceQuery,
  reportsQuery,
  todayBoardQuery,
  todayCountsQuery,
  todayWaitingQuery,
} from '@/features/supervisor/api';
import { prefetchTickets } from '@/features/tickets/config';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { notebookQuery } from '@/lib/notes/api';
import { openingTaskList, tasksQuery } from '@/lib/tasks/api';
import { ASSIGN_PERMISSION, SUPERVISOR_API } from '@/features/supervisor/api';
import {
  botRulesQuery,
  MAIL_PERMISSION,
  mailboxesQuery,
  FIRST_MAILBOXES,
  gmailStatusQuery,
  serversQuery,
} from '@/features/mail/api';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { redirect } from 'react-router';
import { managerPath } from '@/features/supervisor/paths';
import type { PanelDefinition } from '../types';

/** Supervisors who don't assign new cases are sent back to the panel's home. */
async function assignersOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return user && hasPermission(user, ASSIGN_PERMISSION) ? null : redirect('/supervisor');
}

/** The services page waits for Django's client services. */
function servicesOn() {
  return Promise.resolve(ON_SERVER.clientServices ? null : redirect('/supervisor'));
}

/** The manager's pages about services wait for Django's client services. */
function managerServicesOn() {
  return Promise.resolve(ON_SERVER.clientServices ? null : redirect(managerPath()));
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
    ...(ON_SERVER.clientServices
      ? [
          {
            id: 'services',
            to: 'services',
            label: 'panels.supervisor.nav.services',
            icon: 'list',
          } as const,
        ]
      : []),
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
    // The manager's section (can_assign_supervisor), its pages are sub-tabs (ManagerLayout).
    {
      id: 'manager',
      to: 'manager',
      label: 'panels.supervisor.nav.manager',
      icon: 'settings',
      permission: ASSIGN_PERMISSION,
    },
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
      ...lazyPage(() => import('@/features/supervisor/CaseLayout'), ['supervisor', 'notes'], {
        data: ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && caseQuery(id)];
        },
        skeleton: 'detail',
      }),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/supervisor/CaseOverviewPage'), [], {
            data: ({ params }) => {
              const id = idParam(params.id);
              return [
                id !== null && notebookQuery(`${SUPERVISOR_API}/cases/${String(id)}/notebook/`),
              ];
            },
          }),
        },
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
        // One service's tab (SVC9): its owner, conversation, stages and tool.
        {
          path: 'services/:service',
          ...lazyPage(() => import('@/features/supervisor/CaseServicePage'), [], {
            data: ({ params }) => {
              const id = idParam(params.id);
              const service = idParam(params['service']);
              return [
                id !== null && service !== null && serviceQuery(id, service),
                id !== null && applicationsQuery(id),
              ];
            },
          }),
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
        data: ({ request }) => [
          tasksQuery('supervisor'),
          openingTaskList('supervisor', request.url),
        ],
        skeleton: 'list',
      }),
    },
    // The manager's section (can_assign_supervisor): sub-tabs in ManagerLayout.
    {
      path: 'manager',
      loader: assignersOnly,
      ...lazyPage(() => import('@/features/supervisor/manager/ManagerLayout'), ['supervisor']),
      children: [
        // New cases waiting for a supervisor, and services waiting for an owner.
        {
          index: true,
          ...lazyPage(() => import('@/features/supervisor/HandoffsPage'), [], {
            data: () => [handoffsQuery],
            skeleton: 'list',
          }),
        },
        // Every case with its supervisors (`?supervisor=`: one person's, from the team page).
        {
          path: 'cases',
          ...lazyPage(() => import('@/features/supervisor/manager/TeamCasesPage'), [], {
            data: ({ request }) => [
              casesQuery(firstCasesQuery(new URL(request.url).searchParams, true)),
              managerTeamQuery,
            ],
            skeleton: 'list',
          }),
        },
        // Each supervisor's and visa expert's load.
        {
          path: 'team',
          ...lazyPage(() => import('@/features/supervisor/manager/TeamPage'), [], {
            data: () => [managerTeamQuery],
            skeleton: 'list',
          }),
        },
        // Moving one person's cases to another.
        {
          path: 'move',
          ...lazyPage(() => import('@/features/supervisor/manager/MovePage'), [], {
            data: () => [managerTeamQuery],
            skeleton: 'form',
          }),
        },
        // How the services are answered, per team and owner (SVC6).
        {
          path: 'services',
          ...lazyPage(() => import('@/features/supervisor/ServicesReportPage'), [], {
            guard: managerServicesOn,
            data: () => [servicesReportQuery('month')],
            skeleton: 'list',
          }),
        },
        // Supervisors' scopes and where they differ from today's rule (SVC5).
        {
          path: 'scopes',
          ...lazyPage(() => import('@/features/supervisor/ScopesPage'), [], {
            guard: managerServicesOn,
            data: () => [scopesQuery],
            skeleton: 'list',
          }),
        },
      ],
    },
    // Old addresses of the manager's pages (links in tasks and messages).
    { path: 'new', loader: () => redirect(managerPath()) },
    { path: 'scopes', loader: () => redirect(managerPath('scopes')) },
    { path: 'services/report', loader: () => redirect(managerPath('services')) },
    // The services the viewer owns (SVC4), once Django serves them.
    {
      path: 'services',
      ...lazyPage(() => import('@/features/supervisor/MyServicesPage'), ['supervisor'], {
        guard: servicesOn,
        data: () => [myServicesQuery],
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
        data: () => [
          serversQuery,
          gmailStatusQuery,
          botRulesQuery,
          mailboxesQuery(FIRST_MAILBOXES),
        ],
        skeleton: 'list',
      }),
    },
  ],
};
