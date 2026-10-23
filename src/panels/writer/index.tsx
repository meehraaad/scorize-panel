import { ComingSoonPage } from '@/components/ComingSoonPage';
import type { PanelDefinition } from '../types';

/** SOP / CV / recommendation writers (user_profile/writing). Not designed yet. */
export const writerPanel: PanelDefinition = {
  id: 'writer',
  path: 'writer',
  name: 'panels.writer.name',
  navLabel: 'panels.writer.nav.label',
  navigation: [
    {
      id: 'queue',
      to: '',
      label: 'panels.writer.nav.queue',
      tab: 'panels.writer.tabs.queue',
      icon: 'document',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.writer.nav.tickets',
      tab: 'panels.writer.tabs.tickets',
      icon: 'chat',
    },
  ],
  routes: [
    { index: true, element: <ComingSoonPage title="panels.writer.nav.queue" /> },
    { path: 'tickets', element: <ComingSoonPage title="panels.writer.nav.tickets" /> },
  ],
};
