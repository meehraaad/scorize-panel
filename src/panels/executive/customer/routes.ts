import { redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import type { WorkspaceLoader } from './loaders';
import { customerWorkspacePath } from './paths';

const load = (page: Parameters<WorkspaceLoader>[0]) => async (args: LoaderFunctionArgs) =>
  (await import('./loaders')).loadWorkspacePage(page, args);

export const customerWorkspaceRoute: RouteObject = {
  path: 'customers/:id',
  ...lazyPage(() => import('./CustomerWorkspaceLayout'), ['executive', 'supervisor', 'writer'], {
    skeleton: 'detail',
  }),
  loader: load('frame'),
  children: [
    {
      index: true,
      loader: ({ params }) => {
        const id = idParam(params.id);
        return id === null ? null : redirect(customerWorkspacePath(id, 'desk'));
      },
    },
    {
      path: 'desk',
      ...lazyPage(() => import('./CustomerWorkDesk')),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/supervisor/CaseApplicationsPage')),
          loader: load('desk'),
        },
        {
          path: ':service',
          ...lazyPage(() => import('./DeskServicePage')),
          loader: load('service'),
        },
      ],
    },
    {
      path: 'tasks',
      ...lazyPage(() => import('./CustomerTasksPage')),
      loader: load('tasks'),
    },
    {
      path: 'summary',
      ...lazyPage(() => import('./CustomerSummaryPage'), ['notes']),
      loader: load('summary'),
    },
    {
      path: 'contract',
      ...lazyPage(() => import('./CustomerContractPage')),
      loader: load('contract'),
    },
    {
      path: 'information',
      ...lazyPage(() => import('./CustomerInformationPage'), ['sales']),
      loader: load('information'),
    },
    {
      path: 'documents',
      ...lazyPage(() => import('./CustomerDocumentsPage')),
      loader: load('documents'),
    },
    {
      path: 'reports',
      ...lazyPage(() => import('./CustomerReportsPage')),
      loader: load('reports'),
    },
  ],
};
