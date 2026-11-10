import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { salesPath } from '../paths';
import { PHONE_SECTIONS } from './phoneSections';
import { SectionNav } from './SectionNav';

const SECTIONS = [
  { id: 'assign', to: 'manager' },
  { id: 'approvals', to: 'manager/approvals' },
  { id: 'contract', to: 'manager/contract' },
  { id: 'team', to: 'manager/team' },
  { id: 'commission', to: 'manager/commission' },
  { id: 'followUps', to: 'manager/follow-ups' },
  { id: 'stages', to: 'manager/stages' },
  { id: 'tags', to: 'manager/tags' },
  // One tab for the office line; its pages are sub-tabs (PhoneLayout).
  { id: 'phone', to: 'manager/phone', end: false },
] as const;

const OFF = new Set<string>([
  ...(ON_SERVER.customerTags ? [] : ['tags']),
  ...(PHONE_SECTIONS.length ? [] : ['phone']),
]);

/**
 * The sales manager's section: lead assignment, the agreement desk, the contract builder, team
 * report, commission rules, follow-ups, board stages, customer tags and the office phone line.
 */
export default function ManagerLayout() {
  const { t } = useTranslation('sales');
  return (
    <PageStack>
      <SectionNav
        label={t('manager.nav')}
        sections={SECTIONS.filter((section) => !OFF.has(section.id)).map((section) => ({
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
