import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export type ReportDays = 7 | 30;
const periods: readonly ReportDays[] = [7, 30];

export function ReportPeriod({
  days,
  change,
  refresh,
  busy,
}: {
  days: ReportDays;
  change: (days: ReportDays) => void;
  refresh: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation('telemetry');
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('period.label')}>
      {periods.map((period) => (
        <Button
          key={period}
          variant={days === period ? 'primary' : 'outline'}
          aria-pressed={days === period}
          onClick={() => change(period)}
        >
          {t(`period.days${period}`)}
        </Button>
      ))}
      <Button variant="outline" onClick={refresh} disabled={busy}>
        {t('period.refresh')}
      </Button>
    </div>
  );
}
