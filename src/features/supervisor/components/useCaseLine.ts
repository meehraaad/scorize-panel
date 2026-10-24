import { useTranslation } from 'react-i18next';
import type { Degree } from '@/lib/applicant/approval';
import { useFormat } from '@/lib/i18n/useFormat';

/** "#1240 · Master's · Canada and Germany": the line under an applicant's name in lists. */
export function useCaseLine() {
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const f = useFormat();
  return (item: { file_number: number; degree: Degree | null; countries: readonly string[] }) =>
    [
      t('fileNumber', { n: f.digits(String(item.file_number)) }),
      item.degree === null ? '' : tc(`degree.${item.degree}`),
      item.countries.length ? f.list([...item.countries]) : '',
    ]
      .filter(Boolean)
      .join(' · ');
}
