import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { hasPermission, MAILBOXES_PERMISSION } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { ASSIGN_PERMISSION } from '../api/handoffs';
import { managerPath, type ManagerSection } from '../paths';

const SECTIONS: readonly { id: ManagerSection; services?: true }[] = [
  { id: 'new' },
  { id: 'cases' },
  { id: 'team' },
  { id: 'move' },
  { id: 'services', services: true },
  { id: 'scopes', services: true },
  { id: 'kinds', services: true },
];

/**
 * The executive panel's management section: the supervisor manager's pages
 * (`can_assign_supervisor`: new cases and their owners, every case with its supervisors, the team's
 * load, moving cases, how the services are answered, the supervisors' scopes) and the mail servers
 * (`manage_mailboxes`). Each key opens only its own tabs.
 */
export default function ManagerLayout() {
  const { t } = useTranslation('supervisor');
  const user = useUser();
  const assigns = hasPermission(user, ASSIGN_PERMISSION);
  const mail = ON_SERVER.mailServers && hasPermission(user, MAILBOXES_PERMISSION);
  const sections: ManagerSection[] = [
    ...(assigns
      ? SECTIONS.filter((section) => !section.services || ON_SERVER.clientServices).map(
          (section) => section.id,
        )
      : []),
    ...(mail ? (['mail'] as const) : []),
  ];
  return (
    <PageStack>
      <SectionNav
        label={t('manager.nav')}
        sections={sections.map((id) => ({
          id,
          to: managerPath(id),
          label: t(`manager.section.${id}`),
        }))}
      />
      <Outlet />
    </PageStack>
  );
}
