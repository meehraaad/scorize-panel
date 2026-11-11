import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { INSTALMENT_WHEN, MAX_INSTALMENTS, type Instalment, type InstalmentWhen } from '../api';
import { useSalesFormat } from '../format';
import { scheduleTotal, spreadRest } from '../plan';

/** Every way a later instalment can be due (the prepayment is always the first row). */
const LATER: Exclude<InstalmentWhen, 'signing'>[] = INSTALMENT_WHEN.filter(
  (when): when is Exclude<InstalmentWhen, 'signing'> => when !== 'signing',
);

/**
 * The instalments as the seller and the customer agree them in the session (S47): any amounts and
 * count, each on a date or at a step of the case. The first is the prepayment, due at signing.
 */
export function ScheduleEditor({
  schedule,
  total,
  currency = 'IRT',
  onChange,
}: {
  schedule: Instalment[];
  /** The contract's price after the discount, in `currency`. */
  total: number;
  /** ISO code of the contract's money (S74). */
  currency?: string;
  onChange: (schedule: Instalment[]) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const money = (value: number) => s.exact(value, currency);
  const sum = scheduleTotal(schedule);
  const gap = total - sum;

  const change = (index: number, row: Partial<Instalment>) =>
    onChange(schedule.map((item, at) => (at === index ? { ...item, ...row } : item)));

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-semibold text-text-2">
        {t('offer.schedule.title')}
      </legend>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('offer.schedule.hint')}</p>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {schedule.map((row, index) => {
          const number = f.number(index + 1);
          return (
            <li
              key={index}
              className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {index === 0
                    ? t('offer.schedule.prepayment')
                    : t('offer.schedule.row', { n: number })}
                </span>
                {index > 0 && (
                  <IconButton
                    icon="trash"
                    tone="danger"
                    aria-label={t('offer.schedule.remove', { n: number })}
                    onClick={() => onChange(schedule.filter((_, at) => at !== index))}
                  />
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {index === 0 ? (
                  <TextField
                    label={t('offer.schedule.when')}
                    value={t('offer.schedule.whenOption.signing')}
                    readOnly
                  />
                ) : (
                  <SelectField
                    label={t('offer.schedule.when')}
                    value={row.when}
                    onChange={(when) =>
                      change(index, { when, date: when === 'date' ? row.date : null })
                    }
                    options={LATER.map((when) => ({
                      value: when,
                      label: t(`offer.schedule.whenOption.${when}`),
                    }))}
                  />
                )}
                <TextField
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={0}
                  step={1000}
                  label={t('offer.schedule.amount')}
                  value={row.amount ? String(row.amount) : ''}
                  hint={row.amount ? money(row.amount) : undefined}
                  onChange={(event) =>
                    change(index, { amount: Math.max(0, Math.round(Number(event.target.value))) })
                  }
                />
                {row.when === 'date' && (
                  <DatePicker
                    only="future"
                    label={t('offer.schedule.date')}
                    value={row.date ?? ''}
                    onChange={(date) => change(index, { date: date || null })}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={schedule.length >= MAX_INSTALMENTS}
          onClick={() =>
            onChange([...schedule, { amount: Math.max(gap, 0), when: 'date', date: null }])
          }
        >
          {t('offer.schedule.add')}
        </Button>
        {schedule.length > 1 && (
          <Button variant="outline" onClick={() => onChange(spreadRest(schedule, total))}>
            {t('offer.schedule.spread')}
          </Button>
        )}
      </div>

      <p
        aria-live="polite"
        className={`m-0 rounded-2xl px-4 py-3 text-sm ${gap === 0 ? 'bg-good-tint text-good' : 'bg-warn-tint text-warn'}`}
      >
        {t('offer.schedule.total', { sum: money(sum), total: money(total) })}
        {gap !== 0 &&
          ` · ${gap > 0 ? t('offer.schedule.left', { amount: money(gap) }) : t('offer.schedule.over', { amount: money(-gap) })}`}
      </p>
    </fieldset>
  );
}
