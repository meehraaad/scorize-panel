import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { sessionQuery } from '@/lib/auth/session';
import { getRoles } from '@/lib/auth/roles';
import { useContactDrafts } from '@/lib/sales/contactDrafts';
import { useCaseChats } from '@/lib/supervisor/caseChats';

const ContactWorkspace = lazy(() => import('@/features/sales/ContactWorkspace'));
const CaseChatDock = lazy(() => import('@/features/supervisor/chat/CaseChatDock'));

/**
 * Outside page boundaries: staff drafts and supervisors' chat windows survive navigation,
 * including account and panel switches.
 */
export function WorkspaceLayout() {
  const { data: user } = useQuery({ ...sessionQuery, enabled: false });
  const drafts = useContactDrafts();
  const chats = useCaseChats();
  const roles = user ? getRoles(user) : [];
  return (
    <>
      <Outlet />
      {user && drafts.owner === user.id && roles.includes('sales') && drafts.drafts.length > 0 && (
        <Suspense fallback={null}>
          <ContactWorkspace />
        </Suspense>
      )}
      {user &&
        chats.owner === user.id &&
        roles.includes('supervisor') &&
        chats.chats.length > 0 && (
          <Suspense fallback={null}>
            <CaseChatDock />
          </Suspense>
        )}
    </>
  );
}
