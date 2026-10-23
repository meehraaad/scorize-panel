import { ComingSoonPage } from '@/components/ComingSoonPage';
import type { PanelDefinition } from '../types';

/** Design: canvas "V1 · Supervisor panel" and SupervisorV5. */
export const supervisorPanel: PanelDefinition = {
  id: 'supervisor',
  path: 'supervisor',
  name: 'panels.supervisor.name',
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
    { id: 'reports', to: 'reports', label: 'panels.supervisor.nav.reports', icon: 'chart' },
  ],
  routes: [
    { index: true, element: <ComingSoonPage title="panels.supervisor.nav.today" /> },
    { path: 'files', element: <ComingSoonPage title="panels.supervisor.nav.files" /> },
    { path: 'tickets', element: <ComingSoonPage title="panels.supervisor.nav.tickets" /> },
    { path: 'reports', element: <ComingSoonPage title="panels.supervisor.nav.reports" /> },
  ],
};
