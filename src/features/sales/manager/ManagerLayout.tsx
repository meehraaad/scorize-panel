import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { hasPermission } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { MANAGER_PERMISSION } from '../api/manager';
import { salesPath } from '../paths';
import { PHONE_SECTIONS } from './phoneSections';
import { SectionNav } from '@/components/ui/SectionNav';

const SECTIONS = [
  { id: 'assign', to: 'manager' },
  { id: 'approvals', to: 'manager/approvals' },
  { id: 'contract', to: 'manager/contract' },
  { id: 'team', to: 'manager/team' },
  { id: 'commission', to: 'manager/commission' },
  { id: 'consultations', to: 'manager/consultations', end: false },
  { id: 'followUps', to: 'manager/follow-ups' },
  { id: 'stages', to: 'manager/stages' },
  { id: 'tags', to: 'manager/tags' },
  // Migration pathways: the same page as the marketing manager's (features/pathways).
  { id: 'pathways', to: 'manager/pathways', end: false },
  // One tab for the office line; its pages are sub-tabs (PhoneLayout).
  { id: 'phone', to: 'manager/phone', end: false },
] as const;

const OFF = new Set<string>([
  ...(ON_SERVER.customerTags ? [] : ['tags']),
  ...(PHONE_SECTIONS.length ? [] : ['phone']),
  ...(ON_SERVER.pathwaysManagement ? [] : ['pathways']),
]);

/**
 * The sales manager's section: lead assignment, the agreement desk, the contract builder, team
 * report, commission rules, consultation types, follow-ups, board stages, customer tags, migration pathways and the office
 * phone line.
 */
export default function ManagerLayout() {
  const { t } = useTranslation('sales');
  const user = useUser();
  // The phone key alone opens only the phone tab (the route's loader sends other addresses there).
  const whole = hasPermission(user, MANAGER_PERMISSION);
  return (
    <PageStack>
      <SectionNav
        label={t('manager.nav')}
        sections={SECTIONS.filter(
          (section) => !OFF.has(section.id) && (whole || section.id === 'phone'),
        ).map((section) => ({
          id: section.id,
          to: salesPath(section.to),
          label: t(`manager.section.${section.id}`),
          end: 'end' in section ? section.end : true,
        }))}
      />
      <Outlet />
    </PageStack>
  );
}
