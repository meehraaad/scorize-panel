import { redirect } from 'react-router';
import {
  MANAGER_PERMISSION,
  approvalsQuery,
  assignQuery,
  boardQuery,
  customerQuery,
  monthQuery,
  todayQuery,
} from '@/features/sales/api';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { lazyPage } from '@/lib/router/lazyPage';
import { tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';

/** Start a page's request together with its chunk, not after it. A failure shows on the page. */
const prefetch = (load: () => Promise<unknown>) => () => {
  load().catch(() => undefined);
  return null;
};

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
  routes: [
    {
      index: true,
      loader: prefetch(() => queryClient.query(todayQuery)),
      ...lazyPage(() => import('@/features/sales/TodayPage'), ['sales']),
    },
    // Leads and "my consultations" share one nav tab, with a sub-tab each.
    {
      path: 'leads',
      ...lazyPage(() => import('@/features/sales/LeadsLayout'), ['sales']),
      children: [
        { index: true, ...lazyPage(() => import('@/features/sales/LeadsPage')) },
        {
          path: 'consultations',
          ...lazyPage(() => import('@/features/sales/ConsultationsPage')),
        },
      ],
    },
    {
      path: 'board',
      loader: prefetch(() => queryClient.query(boardQuery)),
      ...lazyPage(() => import('@/features/sales/BoardPage'), ['sales']),
    },
    {
      path: 'month',
      loader: prefetch(() => queryClient.query(monthQuery)),
      ...lazyPage(() => import('@/features/sales/MonthPage'), ['sales']),
    },
    // Its old address, before it moved under the leads tab.
    { path: 'consultations', loader: () => redirect('/sales/leads/consultations') },
    {
      path: 'customers/:id',
      loader: ({ params }) => {
        const id = Number(params.id);
        if (Number.isInteger(id) && id > 0)
          queryClient.query(customerQuery(id)).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/sales/CustomerLayout'), ['sales']),
      children: [
        { index: true, ...lazyPage(() => import('@/features/sales/CustomerSummaryPage')) },
        { path: 'purchases', ...lazyPage(() => import('@/features/sales/CustomerPurchasesPage')) },
        { path: 'payments', ...lazyPage(() => import('@/features/sales/CustomerPaymentsPage')) },
        { path: 'info', ...lazyPage(() => import('@/features/sales/CustomerInfoPage')) },
        { path: 'apply', ...lazyPage(() => import('@/features/sales/CustomerApplyPage')) },
      ],
    },
    // Its own page (no customer card): building an offer takes the whole screen.
    {
      path: 'customers/:id/offer',
      ...lazyPage(() => import('@/features/sales/OfferPage'), ['sales']),
    },
    // The sales manager's section (nav item and routes need can_assign_to_seller).
    {
      path: 'manager',
      loader: managerOnly,
      ...lazyPage(() => import('@/features/sales/manager/ManagerLayout'), ['sales']),
      children: [
        {
          index: true,
          loader: prefetch(() => queryClient.query(assignQuery(1))),
          ...lazyPage(() => import('@/features/sales/manager/AssignPage')),
        },
        {
          path: 'approvals',
          loader: prefetch(() => queryClient.query(approvalsQuery)),
          ...lazyPage(() => import('@/features/sales/manager/ApprovalsPage')),
        },
        { path: 'team', ...lazyPage(() => import('@/features/sales/manager/TeamPage')) },
        {
          path: 'follow-ups',
          ...lazyPage(() => import('@/features/sales/manager/FollowUpHealthPage')),
        },
      ],
    },
    {
      path: 'tasks',
      loader: prefetch(() => queryClient.query(tasksQuery('sales'))),
      ...lazyPage(() => import('./TasksPage'), ['tasks']),
    },
  ],
};
