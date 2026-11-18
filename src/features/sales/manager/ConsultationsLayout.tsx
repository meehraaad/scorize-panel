import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { salesPath } from '../paths';

/** The manager's consultations tab: the types with their prices and times first, then the team's booked sessions. */
export default function ConsultationsLayout() {
  const { t } = useTranslation('sales');
  // A type's editor has its own way back; the sub-tabs are for the two lists.
  const editing = useParams().id !== undefined;
  return (
    <PageStack>
      {!editing && (
        <SectionNav
          label={t('manager.sessions.nav')}
          sections={[
            {
              id: 'types',
              to: salesPath('manager/consultations'),
              label: t('manager.sessions.section.types'),
              end: true,
            },
            {
              id: 'sessions',
              to: salesPath('manager/consultations/sessions'),
              label: t('manager.sessions.section.sessions'),
              end: true,
            },
          ]}
        />
      )}
      <Outlet />
    </PageStack>
  );
}
