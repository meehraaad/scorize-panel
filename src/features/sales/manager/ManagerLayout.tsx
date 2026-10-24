import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { tabClass } from '@/components/ui/buttonStyles';
import { PageStack } from '@/components/ui/PageColumns';
import { salesPath } from '../paths';

const SECTIONS = [
  { id: 'assign', to: 'manager' },
  { id: 'approvals', to: 'manager/approvals' },
  { id: 'team', to: 'manager/team' },
  { id: 'followUps', to: 'manager/follow-ups' },
] as const;

/** The sales manager's section: lead assignment, contract approvals, team report, follow-ups. */
export default function ManagerLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      <nav
        aria-label={t('manager.nav')}
        className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.id}
            to={salesPath(section.to)}
            end
            className={({ isActive }) => tabClass(isActive)}
          >
            {t(`manager.section.${section.id}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PageStack>
  );
}
