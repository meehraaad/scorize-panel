import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { sessionQuery } from '@/lib/auth/session';
import { getRoles } from '@/lib/auth/roles';
import { useContactDrafts } from '@/lib/sales/contactDrafts';
import { ON_SERVER } from '@/lib/applicant/onServer';

const ContactWorkspace = lazy(() => import('@/features/sales/ContactWorkspace'));
const LiveCalls = lazy(() => import('@/features/sales/LiveCalls'));

/** Outside page boundaries: staff drafts survive navigation, including account and panel switches. */
export function WorkspaceLayout() {
  const { data: user } = useQuery({ ...sessionQuery, enabled: false });
  const drafts = useContactDrafts();
  return (
    <>
      <Outlet />
      {user && getRoles(user).includes('sales') && ON_SERVER.livePhoneCalls && (
        <Suspense fallback={null}>
          <LiveCalls key={user.id} owner={user.id} />
        </Suspense>
      )}
      {user &&
        drafts.owner === user.id &&
        getRoles(user).includes('sales') &&
        (drafts.drafts.length > 0 || drafts.unknownCalls.length > 0) && (
          <Suspense fallback={null}>
            <ContactWorkspace />
          </Suspense>
        )}
    </>
  );
}
