import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { managerPath, type ManagerSection } from '../paths';

const SECTIONS: readonly { id: ManagerSection; services?: true }[] = [
  { id: 'new' },
  { id: 'services', services: true },
  { id: 'scopes', services: true },
];

/**
 * The supervisor manager's section (`can_assign_supervisor`), like the sales manager's: new cases
 * and their owners, how the services are answered, and the supervisors' scopes.
 */
export default function ManagerLayout() {
  const { t } = useTranslation('supervisor');
  return (
    <PageStack>
      <SectionNav
        label={t('manager.nav')}
        sections={SECTIONS.filter((section) => !section.services || ON_SERVER.clientServices).map(
          (section) => ({
            id: section.id,
            to: managerPath(section.id),
            label: t(`manager.section.${section.id}`),
          }),
        )}
      />
      <Outlet />
    </PageStack>
  );
}
