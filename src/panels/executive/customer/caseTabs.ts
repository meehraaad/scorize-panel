import { ASSIGN_PERMISSION } from '@/features/supervisor/api/handoffs';
import { getRoles, hasPermission } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { CustomerWorkspace } from './api';

export const CASE_TABS = ['summary', 'contract', 'information', 'documents', 'reports'] as const;

export function canOpenCaseTabs(user: SessionUser, workspace: CustomerWorkspace) {
  // Executive managers can see every case, so a missing case is an empty state for them.
  // For other staff it can also mean that the case is outside their scope.
  return (
    Boolean(workspace.case) ||
    (getRoles(user).includes('supervisor') && hasPermission(user, ASSIGN_PERMISSION))
  );
}
