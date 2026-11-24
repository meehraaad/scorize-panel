import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';

/** "68٪", or a dash when no task counted. */
export function useShare() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (value: number | null) =>
    value === null ? t('tasks.none') : t('me.percent', { n: f.number(Math.round(value * 100)) });
}

/** The tone of an on-time share: good from 80%, plum from 70%, else danger. */
export const shareTone = (value: number | null) =>
  value === null
    ? 'text-text-2'
    : value >= 0.8
      ? 'text-good'
      : value >= 0.7
        ? 'text-primary-text'
        : 'text-danger';
