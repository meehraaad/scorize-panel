import {
  activityQuery,
  applicationsQuery,
  caseQuery,
  caseTickets,
  casesQuery,
  documentsQuery,
  firstCasesQuery,
  inboxQuery,
  myServicesQuery,
  serviceQuery,
  reportsQuery,
  todayBoardQuery,
  todayCountsQuery,
  todayWaitingQuery,
} from '@/features/supervisor/api';
import { prefetchTickets } from '@/features/tickets/config';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { notebookQuery } from '@/lib/notes/api';
import { hubAddressFor } from '@/lib/tasks/api';
import { SUPERVISOR_API } from '@/features/supervisor/api';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { redirect } from 'react-router';
import { managerPath } from '@/features/supervisor/paths';
import type { PanelDefinition } from '../types';

/** The services page waits for Django's client services. */
function servicesOn() {
  return Promise.resolve(ON_SERVER.clientServices ? null : redirect('/supervisor'));
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
    { id: 'board', to: 'board', label: 'panels.supervisor.nav.board', icon: 'grid' },
    { id: 'reports', to: 'reports', label: 'panels.supervisor.nav.reports', icon: 'chart' },
  ],
  routes: [
    {
      path: 'board',
      ...lazyPage(
        () =>
          import('@/features/tasks/TeamBoardPage').then((module) => ({
            default: module.SupervisorBoard,
          })),
        ['tasks'],
        { skeleton: 'board' },
      ),
    },
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
    // Its tasks are on the shared page now: old links and bookmarks open them there.
    { path: 'tasks', loader: ({ request }) => redirect(hubAddressFor('supervisor', request.url)) },
    // Old addresses of the manager's pages (links in tasks and messages). The section and the mail
    // page moved to the executive panel's management tab (/executive/manager).
    {
      path: 'manager/*',
      loader: ({ params, request }) =>
        redirect(
          `${managerPath()}${params['*'] ? `/${params['*']}` : ''}${new URL(request.url).search}`,
        ),
    },
    { path: 'mail', loader: () => redirect(managerPath('mail')) },
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
  ],
};
