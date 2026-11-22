import type { RouteObject } from 'react-router';
import { lazyPage } from '@/lib/router/lazyPage';
import { EXECUTION_PATH } from '@/lib/execution/paths';

// The preview has its own synthetic identities, so it sits outside the authenticated panel registry.
export function executionPreviewRoute(): RouteObject {
  return {
    path: EXECUTION_PATH.slice(1),
    ...lazyPage(() => import('@/features/execution/ExecutionLayout'), ['execution'], {
      skeleton: 'list',
    }),
    children: [
      {
        index: true,
        ...lazyPage(() => import('@/features/execution/DeskPage'), ['execution'], {
          skeleton: 'list',
        }),
      },
      {
        path: 'cases/negar',
        ...lazyPage(() => import('@/features/execution/CasePage'), ['execution'], {
          skeleton: 'list',
        }),
      },
      {
        path: 'cases/negar/italy',
        ...lazyPage(() => import('@/features/execution/AdmissionPage'), ['execution'], {
          skeleton: 'list',
        }),
      },
      {
        path: 'cases/negar/italy/search/:requestId',
        ...lazyPage(() => import('@/features/execution/SearchPage'), ['execution'], {
          skeleton: 'form',
        }),
      },
    ],
  };
}
