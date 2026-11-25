import { redirect, replace, type RouteObject } from 'react-router';
import { orderQuery, queueQuery } from '@/features/writer/api';
import { orderPath, WRITING_QUEUE } from '@/features/writer/paths';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { idParam, lazyPage } from '@/lib/router/lazyPage';

async function writersOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return user && !getRoles(user).includes('writer') ? redirect('/executive') : null;
}

export const writingRoutes: RouteObject[] = [
  {
    path: 'writing',
    ...lazyPage(() => import('@/features/writer/QueuePage'), ['writer'], {
      guard: writersOnly,
      data: () => [queueQuery('mine', 1)],
      skeleton: 'list',
    }),
  },
  {
    path: 'writing/orders/:id',
    ...lazyPage(() => import('@/features/writer/OrderPage'), ['writer'], {
      guard: ({ params }) =>
        idParam(params.id) === null ? Promise.resolve(redirect(WRITING_QUEUE)) : writersOnly(),
      data: ({ params }) => [orderQuery(Number(params.id))],
      skeleton: 'detail',
    }),
  },
];

export const writerRedirects: RouteObject[] = [
  { path: 'writer/*', loader: () => replace(WRITING_QUEUE) },
  { path: 'writer/tickets', loader: () => replace('/executive/tickets?department=writing') },
  {
    path: 'writer/orders/:id',
    loader: ({ params }) => {
      const id = idParam(params.id);
      return replace(id === null ? WRITING_QUEUE : orderPath(id));
    },
  },
  {
    path: 'writer/orders/:id/tickets/*',
    loader: ({ params }) => {
      const id = idParam(params.id);
      return replace(id === null ? WRITING_QUEUE : `${orderPath(id)}?chat=1`);
    },
  },
];
