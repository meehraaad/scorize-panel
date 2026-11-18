import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { salesPath } from '../paths';

/** The manager's consultations tab: the team's booked sessions, and the types with their prices and times. */
export default function ConsultationsLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      <SectionNav
        label={t('manager.sessions.nav')}
        sections={[
          {
            id: 'sessions',
            to: salesPath('manager/consultations'),
            label: t('manager.sessions.section.sessions'),
            end: true,
          },
          {
            id: 'types',
            to: salesPath('manager/consultations/types'),
            label: t('manager.sessions.section.types'),
            end: false,
          },
        ]}
      />
      <Outlet />
    </PageStack>
  );
}
