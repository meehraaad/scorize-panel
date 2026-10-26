import { ComingSoonPage } from '@/components/ComingSoonPage';
import { orderQuery, queueQuery } from '@/features/writer/api';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

/**
 * SOP / CV / recommendation writers (user_profile/writing). Design: canvas V8 "پنل نگارش"
 * (WriterQueue, WriterOrder).
 */
export const writerPanel: PanelDefinition = {
  id: 'writer',
  path: 'writer',
  name: 'panels.writer.name',
  description: 'panels.writer.description',
  icon: 'pen',
  tone: 'info',
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
    {
      index: true,
      ...lazyPage(() => import('@/features/writer/QueuePage'), ['writer'], {
        data: () => [queueQuery('mine', 1)],
        skeleton: 'list',
      }),
    },
    {
      path: 'orders/:id',
      ...lazyPage(() => import('@/features/writer/OrderPage'), ['writer'], {
        data: ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && orderQuery(id)];
        },
        skeleton: 'detail',
      }),
    },
    // The order's conversation with the applicant: the shared tickets page, as staff.
    {
      path: 'orders/:id/tickets/*',
      ...lazyPage(() => import('./OrderTicketsPage'), ['writer', 'tickets'], { skeleton: 'chat' }),
    },
    // Every conversation across orders: no design yet (each order links to its own).
    { path: 'tickets', element: <ComingSoonPage title="panels.writer.nav.tickets" /> },
  ],
};
