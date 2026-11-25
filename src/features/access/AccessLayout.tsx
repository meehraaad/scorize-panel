import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { useUser } from '@/lib/auth/session';
import { useAccessPath } from './mutations';

const SECTIONS = [
  { id: 'people', to: '', advanced: false },
  { id: 'history', to: 'history', advanced: false },
  { id: 'groups', to: 'groups', advanced: true },
  { id: 'keys', to: 'keys', advanced: true },
] as const;

/**
 * Management > access: who has which sections and the history. The raw groups and keys underneath
 * are «پیشرفته», for superusers only (their pages still open by address for HR, read-only).
 */
export default function AccessLayout() {
  const { t } = useTranslation('access');
  const root = useAccessPath();
  const me = useUser();
  return (
    <PageStack>
      <SectionNav
        label={t('nav')}
        sections={SECTIONS.filter((section) => me.is_superuser || !section.advanced).map(
          (section) => ({
            id: section.id,
            to: [root, section.to].filter(Boolean).join('/'),
            label: t(`section.${section.id}`),
          }),
        )}
      />
      <Outlet />
    </PageStack>
  );
}
