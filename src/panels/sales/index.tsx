import { redirect } from 'react-router';
import {
  MANAGER_PERMISSION,
  activityQuery,
  applyQuery,
  approvalsQuery,
  assignQuery,
  boardQuery,
  consultationsQuery,
  customerQuery,
  firstLeadQuery,
  leadsQuery,
  healthQuery,
  historyQuery,
  infoQuery,
  leadFilterOf,
  monthQuery,
  offerQuery,
  outreachQuery,
  paymentsQuery,
  purchasesQuery,
  receiptsQuery,
  teamQuery,
} from '@/features/sales/api';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { taskListQuery, tasksQuery } from '@/lib/tasks/api';
import type { LoaderFunctionArgs } from 'react-router';
import type { PanelDefinition } from '../types';

/** A customer page's id, or null (the page says the customer doesn't exist). */
const customerOf = ({ params }: LoaderFunctionArgs) => idParam(params.id);

/** Sellers without the manager's permission are sent back to the panel's home. */
async function managerOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return user && hasPermission(user, MANAGER_PERMISSION) ? null : redirect('/sales');
}

/** Sales and support teams (User.is_seller). Design: canvas "Scorize Seller Panel". */
export const salesPanel: PanelDefinition = {
  id: 'sales',
  path: 'sales',
  name: 'panels.sales.name',
  description: 'panels.sales.description',
  icon: 'phone',
  tone: 'warn',
  navLabel: 'panels.sales.nav.label',
  navigation: [
    {
      id: 'today',
      to: '',
      label: 'panels.sales.nav.today',
      tab: 'panels.sales.tabs.today',
      icon: 'home',
    },
    {
      id: 'leads',
      to: 'leads',
      label: 'panels.sales.nav.leads',
      tab: 'panels.sales.tabs.leads',
      icon: 'user',
    },
    {
      id: 'board',
      to: 'board',
      label: 'panels.sales.nav.board',
      tab: 'panels.sales.tabs.board',
      icon: 'grid',
    },
    {
      id: 'month',
      to: 'month',
      label: 'panels.sales.nav.month',
      tab: 'panels.sales.tabs.month',
      icon: 'chart',
    },
    {
      id: 'manager',
      to: 'manager',
      label: 'panels.sales.nav.manager',
      icon: 'settings',
      permission: MANAGER_PERMISSION,
    },
  ],
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/sales/TodayPage'), ['sales'], {
        data: () => [outreachQuery(1), activityQuery(1), receiptsQuery(1)],
        skeleton: 'dashboard',
      }),
    },
    // Leads and "my consultations" share one nav tab, with a sub-tab each.
    {
      path: 'leads',
      ...lazyPage(() => import('@/features/sales/LeadsLayout'), ['sales']),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/LeadsPage'), [], {
            data: ({ request }) => [
              leadsQuery(
                firstLeadQuery(leadFilterOf(new URL(request.url).searchParams.get('stage'))),
              ),
            ],
            skeleton: 'list',
          }),
        },
        {
          path: 'consultations',
          ...lazyPage(() => import('@/features/sales/ConsultationsPage'), [], {
            data: () => [consultationsQuery('week', null, false, 1)],
            skeleton: 'list',
          }),
        },
      ],
    },
    {
      path: 'board',
      ...lazyPage(() => import('@/features/sales/BoardPage'), ['sales'], {
        data: () => [boardQuery],
        skeleton: 'board',
      }),
    },
    {
      path: 'month',
      ...lazyPage(() => import('@/features/sales/MonthPage'), ['sales'], {
        data: () => [monthQuery],
        skeleton: 'dashboard',
      }),
    },
    // Its old address, before it moved under the leads tab.
    { path: 'consultations', loader: () => redirect('/sales/leads/consultations') },
    {
      path: 'customers/:id',
      ...lazyPage(() => import('@/features/sales/CustomerLayout'), ['sales'], {
        data: (args) => {
          const id = customerOf(args);
          return [id !== null && customerQuery(id)];
        },
        skeleton: 'customer',
      }),
      // Each tab's data starts with the customer's, not after it.
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/CustomerSummaryPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && historyQuery(id)];
            },
          }),
        },
        {
          path: 'purchases',
          ...lazyPage(() => import('@/features/sales/CustomerPurchasesPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && purchasesQuery(id)];
            },
          }),
        },
        {
          path: 'payments',
          ...lazyPage(() => import('@/features/sales/CustomerPaymentsPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && paymentsQuery(id)];
            },
          }),
        },
        {
          path: 'info',
          ...lazyPage(() => import('@/features/sales/CustomerInfoPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && infoQuery(id)];
            },
          }),
        },
        {
          path: 'apply',
          ...lazyPage(() => import('@/features/sales/CustomerApplyPage'), [], {
            data: (args) => {
              const id = customerOf(args);
              return [id !== null && applyQuery(id)];
            },
          }),
        },
      ],
    },
    // Its own page (no customer card): building an offer takes the whole screen.
    {
      path: 'customers/:id/offer',
      ...lazyPage(() => import('@/features/sales/OfferPage'), ['sales'], {
        data: (args) => {
          const id = customerOf(args);
          return id === null ? [] : [customerQuery(id), offerQuery(id)];
        },
        skeleton: 'form',
      }),
    },
    // The sales manager's section (nav item and routes need can_assign_to_seller).
    {
      path: 'manager',
      loader: managerOnly,
      ...lazyPage(() => import('@/features/sales/manager/ManagerLayout'), ['sales']),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/sales/manager/AssignPage'), [], {
            data: () => [assignQuery(1)],
            skeleton: 'list',
          }),
        },
        {
          path: 'approvals',
          ...lazyPage(() => import('@/features/sales/manager/ApprovalsPage'), [], {
            data: () => [approvalsQuery],
            skeleton: 'list',
          }),
        },
        {
          path: 'team',
          ...lazyPage(() => import('@/features/sales/manager/TeamPage'), [], {
            data: () => [teamQuery('month')],
            skeleton: 'dashboard',
          }),
        },
        {
          path: 'follow-ups',
          ...lazyPage(() => import('@/features/sales/manager/FollowUpHealthPage'), [], {
            data: () => [healthQuery('all')],
            skeleton: 'list',
          }),
        },
      ],
    },
    {
      path: 'tasks',
      ...lazyPage(() => import('./TasksPage'), ['tasks'], {
        data: () => [tasksQuery('sales'), taskListQuery('sales', 'mine', 1)],
        skeleton: 'list',
      }),
    },
  ],
};
