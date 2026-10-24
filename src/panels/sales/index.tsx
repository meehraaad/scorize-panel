import { ComingSoonPage } from '@/components/ComingSoonPage';
import { boardQuery, customerQuery, monthQuery, todayQuery } from '@/features/sales/api';
import { queryClient } from '@/lib/api/queryClient';
import { lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

/** Start a page's request together with its chunk, not after it. A failure shows on the page. */
const prefetch = (load: () => Promise<unknown>) => () => {
  load().catch(() => undefined);
  return null;
};

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
  ],
  routes: [
    {
      index: true,
      loader: prefetch(() => queryClient.query(todayQuery)),
      ...lazyPage(() => import('@/features/sales/TodayPage'), ['sales']),
    },
    { path: 'leads', ...lazyPage(() => import('@/features/sales/LeadsPage'), ['sales']) },
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
    // Under "Today" (no nav item).
    {
      path: 'consultations',
      ...lazyPage(() => import('@/features/sales/ConsultationsPage'), ['sales']),
    },
    {
      path: 'customers/:id',
      loader: ({ params }) => {
        const id = Number(params.id);
        if (Number.isInteger(id) && id > 0)
          queryClient.query(customerQuery(id)).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/sales/CustomerPage'), ['sales']),
    },
    { path: 'tasks', element: <ComingSoonPage title="panels.sales.tasks" /> },
  ],
};
