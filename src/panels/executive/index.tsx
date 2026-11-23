import { overviewQuery, workQuery } from '@/features/executive/api';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { lazyPage, prefetchQueries } from '@/lib/router/lazyPage';
import { openingTaskList, tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';
import { caseInboxQuery, ticketDepartment, writingInboxQuery } from './tickets';

export const executivePanel: PanelDefinition = {
  id: 'executive',
  path: 'executive',
  name: 'panels.executive.name',
  description: 'panels.executive.description',
  icon: 'fileCheck',
  tone: 'info',
  navLabel: 'panels.executive.nav.label',
  navigation: [
    {
      id: 'table',
      to: '',
      label: 'panels.executive.nav.table',
      tab: 'panels.executive.nav.table',
      icon: 'home',
    },
    {
      id: 'work',
      to: 'work',
      label: 'panels.executive.nav.work',
      tab: 'panels.executive.nav.work',
      icon: 'folder',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.executive.nav.tickets',
      tab: 'panels.executive.nav.tickets',
      icon: 'chat',
    },
    {
      id: 'tasks',
      to: 'tasks',
      label: 'panels.executive.nav.tasks',
      tab: 'panels.executive.nav.tasks',
      icon: 'fileCheck',
    },
  ],
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/executive/OverviewPage'), ['executive'], {
        data: () => [overviewQuery],
        skeleton: 'list',
      }),
    },
    {
      path: 'work',
      ...lazyPage(() => import('./WorkPage'), ['executive', 'writer'], {
        data: ({ request }) => [overviewQuery, workQuery(new URL(request.url).searchParams)],
        skeleton: 'list',
      }),
    },
    {
      path: 'tickets',
      ...lazyPage(() => import('./TicketsPage'), ['executive', 'supervisor', 'writer'], {
        skeleton: 'list',
      }),
      loader: async ({ request }) => {
        const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
        const roles = user ? getRoles(user) : [];
        if (roles.includes('executive')) {
          const department = ticketDepartment(roles, new URL(request.url).searchParams);
          prefetchQueries([
            department === 'writing'
              ? writingInboxQuery('waiting', 1)
              : caseInboxQuery('waiting', 1),
          ]);
        }
        return null;
      },
    },
    {
      path: 'tasks',
      ...lazyPage(() => import('./TasksPage'), ['tasks'], {
        data: ({ request }) => [tasksQuery('executive'), openingTaskList('executive', request.url)],
        skeleton: 'list',
      }),
    },
  ],
};
