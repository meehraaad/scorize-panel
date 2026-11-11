import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { buttonClass } from '@/components/ui/buttonStyles';
import { exportHref } from '../actions';
import type { Range } from '../api';

/** The report of this range as an Excel file (daily and summary sheets) or a CSV of the days. */
export function ExportLinks({ range }: { range: Range }) {
  const { t } = useTranslation('attendance');
  return (
    <div className="flex flex-wrap gap-2">
      <a href={exportHref(range, 'xlsx')} download className={buttonClass('outline')}>
        <Icon name="download" size={18} />
        {t('export.xlsx')}
      </a>
      <a href={exportHref(range, 'csv')} download className={buttonClass('outline')}>
        <Icon name="download" size={18} />
        {t('export.csv')}
      </a>
    </div>
  );
}
