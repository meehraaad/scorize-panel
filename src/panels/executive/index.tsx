import { redirect } from 'react-router';
import { WRITING_QUEUE } from '@/features/writer/paths';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles } from '@/lib/auth/roles';
import { sessionQuery, useSession } from '@/lib/auth/session';
import { lazyPage, prefetchQueries } from '@/lib/router/lazyPage';
import { hubAddressFor } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';
import { customerWorkspaceRoute } from './customer/routes';
import { managerNavItem, managerRoute } from './manager';
import { writingRoutes } from './writing';

const session = () => queryClient.query({ ...sessionQuery, staleTime: 'static' });
const HIDE_WRITING = new Set(['writing']);
const WRITING_ONLY = new Set(['customers', 'tickets', 'manager', 'board']);
const NO_HIDDEN = new Set<string>();

export const executivePanel: PanelDefinition = {
  id: 'executive',
  path: 'executive',
  name: 'panels.executive.name',
  description: 'panels.executive.description',
  // Its own icon: the supervisor panel's is fileCheck, and people in both tell them apart in the switcher.
  icon: 'list',
  tone: 'info',
  navLabel: 'panels.executive.nav.label',
  useHiddenNav: () => {
    const user = useSession();
    const roles = user ? getRoles(user) : [];
    if (!roles.includes('executive')) return WRITING_ONLY;
    return roles.includes('writer') ? NO_HIDDEN : HIDE_WRITING;
  },
  navigation: [
    {
      id: 'customers',
      to: 'customers',
      label: 'panels.executive.nav.customers',
      tab: 'panels.executive.nav.customers',
      icon: 'user',
    },
    {
      id: 'writing',
      to: 'writing',
      label: 'panels.executive.nav.writing',
      tab: 'panels.executive.nav.orders',
      icon: 'pen',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.executive.nav.tickets',
      tab: 'panels.executive.nav.tickets',
      icon: 'chat',
    },
    { id: 'board', to: 'board', label: 'panels.executive.nav.board', icon: 'grid' },
    // Executive management: the supervisor manager's pages and the mail servers, by key.
    managerNavItem,
  ],
  routes: [
    {
      index: true,
      loader: async () => {
        const user = await session();
        const roles = user ? getRoles(user) : [];
        if (roles.includes('executive')) return redirect('/executive/customers');
        return roles.includes('writer') ? redirect(WRITING_QUEUE) : null;
      },
    },
    { path: 'work', loader: () => redirect('/executive') },
    {
      path: 'board',
      ...lazyPage(
        () =>
          import('@/features/tasks/TeamBoardPage').then((module) => ({
            default: module.ExecutiveBoard,
          })),
        ['tasks'],
        { skeleton: 'board' },
      ),
    },
    ...writingRoutes,
    // The Writer APIs also serve writers without Executive customer access.
    {
      loader: async () => {
        const user = await session();
        const roles = user ? getRoles(user) : [];
        return roles.includes('writer') && !roles.includes('executive')
          ? redirect(WRITING_QUEUE)
          : null;
      },
      children: [
        {
          path: 'customers',
          ...lazyPage(() => import('./CustomersPage'), ['executive', 'supervisor', 'writer'], {
            skeleton: 'list',
          }),
          loader: async ({ request }) => {
            const [user, { customerListQueries }] = await Promise.all([
              session(),
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
            const [user, { caseInboxQuery, ticketDepartment, writingInboxQuery }] =
              await Promise.all([session(), import('./tickets')]);
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
        // Its tasks are on the shared page now: old links and bookmarks open them there.
        {
          path: 'tasks',
          loader: ({ request }) => redirect(hubAddressFor('executive', request.url)),
        },
        managerRoute,
      ],
    },
  ],
};
