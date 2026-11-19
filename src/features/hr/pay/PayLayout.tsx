import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { hrPath } from '../paths';

const SECTIONS = [
  { id: 'month', to: '', end: true },
  { id: 'plans', to: 'plans' },
  { id: 'payroll', to: 'payroll' },
  { id: 'settings', to: 'settings' },
] as const;

/**
 * «حقوق و KPI» (canvas "KPI ساده"): this month's scores to check and close, each group's score
 * plan, the month's pay and the settings. The detailed pages (every KPI, every rule, every value)
 * stay at `results`, `kpis` and `rules`, linked from the settings and the plans.
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
