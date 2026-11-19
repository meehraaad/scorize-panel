import { redirect, type LoaderFunctionArgs } from 'react-router';
import { MARKETING_MANAGER_PERMISSION } from '@/features/marketing/boardApi';
import {
  MARKETING_PATHWAYS_PATH,
  SALES_PATHWAYS_PATH,
  managedPathwayQuery,
  managedPathwaysQuery,
} from '@/features/pathways/manageApi';
import { MANAGER_PERMISSION } from '@/features/sales/api/manager';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { START_PATH, sessionQuery } from '@/lib/auth/session';
import { idParam, lazyPage } from '@/lib/router/lazyPage';

/**
 * Migration pathways (features/pathways): the same two pages, at `pathways` in the sales manager's
 * area and in the marketing manager's. Their manager area's guard opens them; Django lets either
 * manager (or the key `pathways.manage_pathways`) edit the same data.
 */
export function pathwayRoutes() {
  if (!ON_SERVER.pathwaysManagement) return [];
  return [
    {
      path: 'pathways',
      ...lazyPage(() => import('@/features/pathways/ManagePathwaysPage'), ['pathways'], {
        data: () => [managedPathwaysQuery],
        skeleton: 'list',
      }),
    },
    {
      // `new` too: no id, an empty form.
      path: 'pathways/:id',
      ...lazyPage(() => import('@/features/pathways/ManagePathwayPage'), ['pathways'], {
        data: ({ params }) => {
          const id = idParam(params.id);
          return [managedPathwaysQuery, id !== null && managedPathwayQuery(id)];
        },
        skeleton: 'form',
      }),
    },
  ];
}

/** The pathways' earlier address (the management panel): the sales or the marketing manager's page. */
export async function toPathways({ params }: LoaderFunctionArgs) {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  const base =
    user && hasPermission(user, MANAGER_PERMISSION)
      ? SALES_PATHWAYS_PATH
      : user && hasPermission(user, MARKETING_MANAGER_PERMISSION)
        ? MARKETING_PATHWAYS_PATH
        : null;
  if (!base) return redirect(START_PATH);
  return redirect(params.id ? `${base}/${encodeURIComponent(params.id)}` : base);
}
