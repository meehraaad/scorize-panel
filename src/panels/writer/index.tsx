import { ComingSoonPage } from '@/components/ComingSoonPage';
import { orderQuery, queueQuery } from '@/features/writer/api';
import { queryClient } from '@/lib/api/queryClient';
import { lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

/** The order of an `orders/:id` route, or null for a bad id (the page says so). */
const orderIdOf = (params: { id?: string | undefined }) => {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

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
      loader: () => {
        queryClient.query(queueQuery('mine', 1)).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/writer/QueuePage'), ['writer']),
    },
    {
      path: 'orders/:id',
      loader: ({ params }) => {
        const id = orderIdOf(params);
        if (id) queryClient.query(orderQuery(id)).catch(() => undefined);
        return null;
      },
      ...lazyPage(() => import('@/features/writer/OrderPage'), ['writer']),
    },
    // The order's conversation with the applicant: the shared tickets page, as staff.
    {
      path: 'orders/:id/tickets/*',
      ...lazyPage(() => import('./OrderTicketsPage'), ['writer', 'tickets']),
    },
    // Every conversation across orders: no design yet (each order links to its own).
    { path: 'tickets', element: <ComingSoonPage title="panels.writer.nav.tickets" /> },
  ],
};
