import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { useAccessPath } from './api';

const SECTIONS = [
  { id: 'people', to: '' },
  { id: 'groups', to: 'groups' },
  { id: 'keys', to: 'keys' },
  { id: 'history', to: 'history' },
] as const;

/** Management > access: who has what, the groups, every key and the history, each a sub-tab. */
export default function AccessLayout() {
  const { t } = useTranslation('access');
  const root = useAccessPath();
  return (
    <PageStack>
      <SectionNav
        label={t('nav')}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          to: [root, section.to].filter(Boolean).join('/'),
          label: t(`section.${section.id}`),
        }))}
      />
      <Outlet />
    </PageStack>
  );
}
