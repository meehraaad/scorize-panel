import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionNav } from '@/components/ui/SectionNav';
import { hasPermission } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { MESSAGES_PATH, READY_PERMISSION, SYSTEM_PERMISSION } from './api';

const SECTIONS = [
  { id: 'system', to: '', permission: SYSTEM_PERMISSION },
  { id: 'ready', to: 'ready', permission: READY_PERMISSION },
] as const;

/**
 * Management > messages: the automatic messages and the ready ones, a sub-tab each for the
 * holders of its key (one key: no tabs).
 */
export default function MessagesLayout() {
  const { t } = useTranslation('messages');
  const user = useUser();
  const sections = SECTIONS.filter((section) => hasPermission(user, section.permission));
  return (
    <PageStack>
      {sections.length > 1 && (
        <SectionNav
          label={t('nav')}
          sections={sections.map((section) => ({
            id: section.id,
            to: [MESSAGES_PATH, section.to].filter(Boolean).join('/'),
            label: t(`section.${section.id}`),
          }))}
        />
      )}
      <Outlet />
    </PageStack>
  );
}
