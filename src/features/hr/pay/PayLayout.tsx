import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { hrPath } from '../paths';

const SECTIONS = [
  { id: 'payroll', to: '', end: true },
  { id: 'results', to: 'results' },
  { id: 'kpis', to: 'kpis' },
  { id: 'settings', to: 'settings' },
] as const;

/**
 * «حقوق و KPI» (canvas "HR panel" v2: KPI definition, monthly pay, payslip): the month's pay, the
 * month's KPI results, each position's KPIs and how pay is worked out, each a sub-tab.
 */
export default function PayLayout() {
  const { t } = useTranslation('hr');
  return (
    <PageStack>
      <PageHeader title={t('pay.title')} subtitle={t('pay.subtitle')} />
      <SectionNav
        label={t('pay.nav')}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          to: hrPath(['pay', section.to].filter(Boolean).join('/')),
          label: t(`pay.section.${section.id}`),
          ...('end' in section && { end: section.end }),
        }))}
      />
      <Outlet />
    </PageStack>
  );
}
