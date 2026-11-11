import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { MESSAGES_PERMISSIONS, hasAnyPermission } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { MANAGER_PERMISSION } from '../api';
import { salesPath } from '../paths';
import { PHONE_SECTIONS } from './phoneSections';

/** Who sees a tab: the sales manager's key, either messages key, or superusers only. */
type Needs = 'manager' | 'messages' | 'superuser';

type SectionId =
  | 'assign'
  | 'approvals'
  | 'contract'
  | 'team'
  | 'commission'
  | 'followUps'
  | 'stages'
  | 'tags'
  | 'phone'
  | 'messages'
  | 'access';

const SECTIONS: readonly { id: SectionId; to: string; needs: Needs; end?: boolean }[] = [
  { id: 'assign', to: 'manager', needs: 'manager' },
  { id: 'approvals', to: 'manager/approvals', needs: 'manager' },
  { id: 'contract', to: 'manager/contract', needs: 'manager' },
  { id: 'team', to: 'manager/team', needs: 'manager' },
  { id: 'commission', to: 'manager/commission', needs: 'manager' },
  { id: 'followUps', to: 'manager/follow-ups', needs: 'manager' },
  { id: 'stages', to: 'manager/stages', needs: 'manager' },
  { id: 'tags', to: 'manager/tags', needs: 'manager' },
  // One tab for the office line; its pages are sub-tabs (PhoneLayout).
  { id: 'phone', to: 'manager/phone', needs: 'manager', end: false },
  // The automatic and ready messages, a sub-tab each (MessagesLayout).
  { id: 'messages', to: 'manager/messages', needs: 'messages', end: false },
  // Keys, groups and who holds what (AccessLayout).
  { id: 'access', to: 'manager/access', needs: 'superuser', end: false },
];

const OFF = new Set<string>([
  ...(ON_SERVER.customerTags ? [] : ['tags']),
  ...(PHONE_SECTIONS.length ? [] : ['phone']),
  ...(ON_SERVER.messageCenter ? [] : ['messages']),
  ...(ON_SERVER.accessPage ? [] : ['access']),
]);

/**
 * The management area: the sales manager's tabs (lead assignment, the agreement desk, the contract
 * builder, team report, commission rules, follow-ups, board stages, customer tags, the office phone
 * line), the messages for holders of their keys, and access (keys and groups) for superusers.
 * Each person sees only the tabs their keys open.
 */
export default function ManagerLayout() {
  const { t } = useTranslation('sales');
  const user = useUser();
  const allowed: Record<Needs, boolean> = {
    manager: hasAnyPermission(user, MANAGER_PERMISSION),
    messages: hasAnyPermission(user, MESSAGES_PERMISSIONS),
    superuser: user.is_superuser,
  };
  return (
    <PageStack>
      <SectionNav
        label={t('manager.nav')}
        sections={SECTIONS.filter((section) => !OFF.has(section.id) && allowed[section.needs]).map(
          (section) => ({
            id: section.id,
            to: salesPath(section.to),
            label: t(`manager.section.${section.id}`),
            end: section.end ?? true,
          }),
        )}
      />
      <Outlet />
    </PageStack>
  );
}
