import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';

/** A length of time in its largest whole unit: "45 minutes", "3 hours", "2 days". */
export function useDuration() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  return (minutes: number) => {
    if (minutes < 60)
      return t('reports.minutes', { n: f.number(Math.max(1, Math.round(minutes))) });
    if (minutes < 24 * 60) return t('reports.hours', { n: f.number(Math.round(minutes / 60)) });
    return t('reports.days', { n: f.number(Math.round(minutes / (24 * 60))) });
  };
}
