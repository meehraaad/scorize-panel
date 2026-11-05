import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { sessionQuery } from '@/lib/auth/session';
import { getRoles } from '@/lib/auth/roles';

const SalesWorkspace = lazy(() => import('@/features/sales/SalesWorkspace'));
const CaseChatDock = lazy(() => import('@/features/supervisor/chat/CaseChatDock'));

/**
 * Outside page boundaries: staff drafts, sellers' live calls and supervisors' chat windows survive
 * navigation, including account and panel switches. Both load after the page, for their role only,
 * and put back this tab's drafts and windows.
 */
export function WorkspaceLayout() {
  const { data: user } = useQuery({ ...sessionQuery, enabled: false });
  const roles = user ? getRoles(user) : [];
  return (
    <>
      <Outlet />
      {user && roles.includes('sales') && (
        <Suspense fallback={null}>
          <SalesWorkspace key={user.id} owner={user.id} />
        </Suspense>
      )}
      {user && roles.includes('supervisor') && (
        <Suspense fallback={null}>
          <CaseChatDock key={user.id} owner={user.id} />
        </Suspense>
      )}
    </>
  );
}
