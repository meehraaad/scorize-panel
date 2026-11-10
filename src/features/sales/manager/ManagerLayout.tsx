import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { tabClass } from '@/components/ui/buttonStyles';
import { PageStack } from '@/components/ui/PageColumns';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { salesPath } from '../paths';

const SECTIONS = [
  { id: 'assign', to: 'manager' },
  { id: 'approvals', to: 'manager/approvals' },
  { id: 'contract', to: 'manager/contract' },
  { id: 'team', to: 'manager/team' },
  { id: 'commission', to: 'manager/commission' },
  { id: 'followUps', to: 'manager/follow-ups' },
  { id: 'stages', to: 'manager/stages' },
  { id: 'tags', to: 'manager/tags' },
  { id: 'hours', to: 'manager/hours' },
  { id: 'phoneTeams', to: 'manager/phone-teams' },
  { id: 'phoneMenus', to: 'manager/phone-menus' },
  { id: 'phoneVoices', to: 'manager/phone-voices' },
] as const;

const OFF = new Set<string>([
  ...(ON_SERVER.customerTags ? [] : ['tags']),
  ...(ON_SERVER.officeHours ? [] : ['hours']),
  ...(ON_SERVER.phoneTeams ? [] : ['phoneTeams']),
  ...(ON_SERVER.phoneMenus ? [] : ['phoneMenus']),
  ...(ON_SERVER.phoneVoices ? [] : ['phoneVoices']),
]);

/**
 * The sales manager's section: lead assignment, the agreement desk, the contract builder, team
 * report, commission rules, follow-ups, board stages, customer tags, the office line's hours, teams, menus and greetings.
 */
export default function ManagerLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      <nav
        aria-label={t('manager.nav')}
        className="relative -mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
      >
        {SECTIONS.filter((section) => !OFF.has(section.id)).map((section) => (
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
