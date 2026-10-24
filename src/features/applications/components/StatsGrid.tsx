import { useTranslation } from 'react-i18next';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ApplicationsData } from '../api';
import { groupOf } from '../groups';

/** Four numbers at the top: made, waiting for you, in progress, admissions. */
export function StatsGrid({ data }: { data: ApplicationsData }) {
  const { t } = useTranslation('applications');
  const f = useFormat();
  const count = (group: ReturnType<typeof groupOf>) =>
    f.number(data.results.filter((item) => groupOf(item) === group).length);

  return (
    <StatGrid
      label={t('stats.label')}
      stats={[
        {
          label: t('stats.done'),
          value: f.number(data.applies.used),
          unit: t('stats.doneUnit', { total: f.number(data.applies.total) }),
        },
        {
          label: t('stats.awaiting'),
          value: count('awaiting'),
          unit: t('stats.unitApply'),
          tone: 'primary',
        },
        { label: t('stats.inReview'), value: count('inReview'), unit: t('stats.unitApply') },
        {
          label: t('stats.accepted'),
          value: count('accepted'),
          unit: t('stats.unitUniversity'),
          tone: 'good',
        },
      ]}
    />
  );
}
