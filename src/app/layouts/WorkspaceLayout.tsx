import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useCallback, useSyncExternalStore } from 'react';
import { Outlet } from 'react-router';
import { sessionQuery, type SessionUser } from '@/lib/auth/session';
import { getRoles } from '@/lib/auth/roles';

const SalesWorkspace = lazy(() => import('@/features/sales/SalesWorkspace'));
const CaseChatDock = lazy(() => import('@/features/supervisor/chat/CaseChatDock'));

/**
 * Outside page boundaries: staff drafts, sellers' live calls and supervisors' chat windows survive
 * navigation, including account and panel switches. Both load after the page, for their role only,
 * and put back this tab's drafts and windows.
 */
export function WorkspaceLayout() {
  const client = useQueryClient();
  // This frame only observes cached identity. A disabled QueryObserver can cancel
  // the loader's in-flight request during StrictMode cleanup on a cold load.
  const subscribe = useCallback(
    (notify: () => void) => client.getQueryCache().subscribe(notify),
    [client],
  );
  const snapshot = useCallback(
    () => client.getQueryData<SessionUser | null>(sessionQuery.queryKey),
    [client],
  );
  const user = useSyncExternalStore(subscribe, snapshot, snapshot);
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
