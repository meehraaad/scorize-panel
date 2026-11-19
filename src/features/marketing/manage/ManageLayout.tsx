import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { marketingPath } from '../paths';

const SECTIONS = [
  { id: 'team', to: 'manage', end: true },
  { id: 'stages', to: 'manage/stages' },
  { id: 'types', to: 'manage/types' },
  // Migration pathways: the same page as the sales manager's (features/pathways).
  { id: 'pathways', to: 'manage/pathways', end: false },
] as const;

const OFF = new Set<string>(ON_SERVER.pathwaysManagement ? [] : ['pathways']);

/**
 * The marketing manager's area (canvas "مدیر مارکتینگ"): the team (review queue, attendance, tasks),
 * the board's stages, the card types and the migration pathways, each a sub-tab. Key `apply.can_manage_marketing`.
 */
export default function ManageLayout() {
  const { t } = useTranslation('marketing');
  return (
    <PageStack>
      <PageHeader title={t('manage.title')} subtitle={t('manage.subtitle')} />
      <SectionNav
        label={t('manage.nav')}
        sections={SECTIONS.filter((section) => !OFF.has(section.id)).map((section) => ({
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
