import { ComingSoonPage } from '@/components/ComingSoonPage';
import type { PanelDefinition } from '../types';

/** Sales and support teams (User.is_seller). Not designed yet. */
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
      id: 'leads',
      to: '',
      label: 'panels.sales.nav.leads',
      tab: 'panels.sales.tabs.leads',
      icon: 'user',
    },
    {
      id: 'customers',
      to: 'customers',
      label: 'panels.sales.nav.customers',
      tab: 'panels.sales.tabs.customers',
      icon: 'grid',
    },
  ],
  routes: [
    { index: true, element: <ComingSoonPage title="panels.sales.nav.leads" /> },
    { path: 'customers', element: <ComingSoonPage title="panels.sales.nav.customers" /> },
  ],
};
