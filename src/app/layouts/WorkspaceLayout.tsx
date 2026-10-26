import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { sessionQuery } from '@/lib/auth/session';
import { getRoles } from '@/lib/auth/roles';
import { useContactDrafts } from '@/lib/sales/contactDrafts';

const ContactWorkspace = lazy(() => import('@/features/sales/ContactWorkspace'));

/** Outside page boundaries: staff drafts survive navigation, including account and panel switches. */
export function WorkspaceLayout() {
  const { data: user } = useQuery({ ...sessionQuery, enabled: false });
  const drafts = useContactDrafts();
  return (
    <>
      <Outlet />
      {user &&
        drafts.owner === user.id &&
        getRoles(user).includes('sales') &&
        drafts.drafts.length > 0 && (
          <Suspense fallback={null}>
            <ContactWorkspace />
          </Suspense>
        )}
    </>
  );
}
