import { redirect } from 'react-router';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { lazyPage, prefetchQueries } from '@/lib/router/lazyPage';
import { openingTaskList, tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';
import { customerWorkspaceRoute } from './customer/routes';
import { managerNavItem, managerRoute } from './manager';

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
      id: 'customers',
      to: 'customers',
      label: 'panels.executive.nav.customers',
      tab: 'panels.executive.nav.customers',
      icon: 'user',
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
    // Executive management: the supervisor manager's pages and the mail servers, by key.
    managerNavItem,
  ],
  routes: [
    // The panel opens on its customers (the old overview and work table were removed).
    { index: true, loader: () => redirect('/executive/customers') },
    { path: 'work', loader: () => redirect('/executive/customers') },
    {
      path: 'customers',
      ...lazyPage(() => import('./CustomersPage'), ['executive', 'supervisor', 'writer'], {
        skeleton: 'list',
      }),
      loader: async ({ request }) => {
        const [user, { customerListQueries }] = await Promise.all([
          queryClient.query({ ...sessionQuery, staleTime: 'static' }),
          import('./customersApi'),
        ]);
        if (user && getRoles(user).includes('executive')) {
          prefetchQueries(customerListQueries(new URL(request.url).searchParams));
        }
        return null;
      },
    },
    customerWorkspaceRoute,
    {
      path: 'tickets',
      ...lazyPage(() => import('./TicketsPage'), ['executive', 'supervisor', 'writer'], {
        skeleton: 'list',
      }),
      loader: async ({ request }) => {
        const [user, { caseInboxQuery, ticketDepartment, writingInboxQuery }] = await Promise.all([
          queryClient.query({ ...sessionQuery, staleTime: 'static' }),
          import('./tickets'),
        ]);
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
    managerRoute,
  ],
};
