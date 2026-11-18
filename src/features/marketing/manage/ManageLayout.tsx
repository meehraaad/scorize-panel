import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { marketingPath } from '../paths';

const SECTIONS = [
  { id: 'team', to: 'manage', end: true },
  { id: 'stages', to: 'manage/stages' },
  { id: 'types', to: 'manage/types' },
] as const;

/**
 * The marketing manager's area (canvas "مدیر مارکتینگ"): the team (review queue, attendance, tasks),
 * the board's stages and the card types, each a sub-tab. Key `apply.can_manage_marketing`.
 */
export default function ManageLayout() {
  const { t } = useTranslation('marketing');
  return (
    <PageStack>
      <PageHeader title={t('manage.title')} subtitle={t('manage.subtitle')} />
      <SectionNav
        label={t('manage.nav')}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          to: marketingPath(section.to),
          label: t(`manage.${section.id}`),
          ...('end' in section && { end: section.end }),
        }))}
      />
      <Outlet />
    </PageStack>
  );
}
