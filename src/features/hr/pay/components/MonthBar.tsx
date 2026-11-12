import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { useFormat } from '@/lib/i18n/useFormat';
import { firstDayOf, type PayMonth } from '../api';

/** The month a pay page shows, with the previous and next ones (no later than next month). */
export function MonthBar({
  month,
  shift,
  onShift,
  children,
}: {
  month: PayMonth;
  shift: number;
  onShift: (shift: number) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton
        icon="chevronEnd"
        aria-label={t('pay.previous')}
        onClick={() => onShift(shift - 1)}
      />
      <h2 className="m-0 min-w-40 text-center text-[17px] font-bold" aria-live="polite">
        {f.monthYear(firstDayOf(month))}
      </h2>
      <IconButton
        icon="chevronStart"
        aria-label={t('pay.next')}
        disabled={shift >= 1}
        onClick={() => onShift(shift + 1)}
      />
      {children && <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
