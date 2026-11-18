import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { attendancePath } from './api';

const SECTIONS = [
  { id: 'daily', to: '' },
  { id: 'monthly', to: 'month' },
  { id: 'settings', to: 'settings' },
] as const;

/**
 * «حضور و غیاب» in the HR panel: the office terminal's day, the month per person, and the
 * settings (the counted week, the terminal and who each of its numbers is), each a sub-tab.
 */
export default function AttendanceLayout() {
  const { t } = useTranslation('attendance');
  return (
    <PageStack>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <SectionNav
        label={t('nav')}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          to: attendancePath(section.to),
          label: t(`section.${section.id}`),
        }))}
      />
      <Outlet />
    </PageStack>
  );
}
