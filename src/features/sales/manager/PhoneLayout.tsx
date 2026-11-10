import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { salesPath } from '../paths';
import { PHONE_SECTIONS } from './phoneSections';
import { SectionNav } from './SectionNav';

/** The office line's settings: hours, teams, menu keys and greetings, each a sub-tab. */
export default function PhoneLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      {PHONE_SECTIONS.length > 1 && (
        <SectionNav
          label={t('manager.phone.nav')}
          sections={PHONE_SECTIONS.map((section) => ({
            id: section.id,
            to: salesPath(`manager/phone/${section.path}`),
            label: t(`manager.phone.section.${section.id}`),
          }))}
        />
      )}
      <Outlet />
    </PageStack>
  );
}
