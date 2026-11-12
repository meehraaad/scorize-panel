import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { parseValue } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { dailyQuery, monthRange, summaryQuery, type PersonTotals, type Range } from './api';
import { ExportLinks } from './components/ExportLinks';
import { PersonName } from './components/PersonName';
import { STATUS_TONE, clockOf } from './format';

/**
 * A month (in the user's calendar) per person: days present, hours, late days, absences. A row
 * opens that person's days.
 */
export default function MonthlyPage() {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  const cal = useCalendar();
  const [shift, setShift] = useState(0);
  const range = monthRange(cal.kind, shift);
  const { data } = useSuspenseQuery(summaryQuery(range));
  const [open, setOpen] = useState<string | null>(null);
  const first = parseValue(range.from);

  return (
    <PageStack>
      <PageHeader
        title={t('monthly.title')}
        subtitle={t('monthly.subtitle', { start: f.digits(data.start ?? '–') })}
        actions={<ExportLinks range={range} />}
      />
      <Card aria-label={t('monthly.label')}>
        <div className="flex items-center gap-2 px-3 pt-4 lg:px-6">
          <IconButton
            icon="chevronEnd"
            aria-label={t('monthly.previous')}
            onClick={() => setShift(shift - 1)}
          />
          <h2 className="m-0 min-w-40 text-center text-[17px] font-bold" aria-live="polite">
            {first ? f.monthYear(first) : ''}
          </h2>
          <IconButton
            icon="chevronStart"
            aria-label={t('monthly.next')}
            disabled={shift >= 0}
            onClick={() => setShift(shift + 1)}
          />
        </div>
        {data.results.length === 0 ? (
          <EmptyState variant="padded">{t('monthly.empty')}</EmptyState>
        ) : (
          <ul className="m-0 mt-3 list-none p-0">
            {data.results.map((row) => {
              const key = `${String(row.employee_id)}-${String(row.enroll_id)}`;
              return (
                <li key={key}>
                  <TotalsRow
                    row={row}
                    expanded={open === key}
                    onToggle={() => setOpen(open === key ? null : key)}
                    range={range}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageStack>
  );
}

function TotalsRow({
  row,
  expanded,
  onToggle,
  range,
}: {
  row: PersonTotals;
  expanded: boolean;
  onToggle: () => void;
  range: Range;
}) {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  return (
    <div className="shadow-[inset_0_1px_0_var(--hair)]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 text-start hover:bg-canvas lg:px-8"
      >
        <span className="min-w-0 flex-[1_1_200px] text-[15px]">
          <PersonName name={row.name} employeeId={row.employee_id} enrollId={row.enroll_id} />
        </span>
        <span className="flex flex-[1_1_320px] flex-wrap gap-x-5 gap-y-1 text-[14px] text-text-2">
          <span>{t('monthly.present', { n: f.number(row.days_present) })}</span>
          <span>{t('monthly.hours', { hours: f.digits(clockOf(row.worked_seconds)) })}</span>
          {row.late_days > 0 && (
            <Chip tone="warn" small>
              {t('monthly.late', { n: f.number(row.late_days) })}
            </Chip>
          )}
          {row.absent_days > 0 && (
            <Chip tone="danger" small>
              {t('monthly.absent', { n: f.number(row.absent_days) })}
            </Chip>
          )}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`text-text-2 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && <Days row={row} range={range} />}
    </div>
  );
}

function Days({ row, range }: { row: PersonTotals; range: Range }) {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  const { data } = useQuery(
    dailyQuery(
      row.employee_id
        ? { ...range, employee: row.employee_id }
        : { ...range, enroll: row.enroll_id },
    ),
  );
  if (!data) return <SkeletonRows rows={3} />;
  return (
    <ul className="m-0 list-none bg-canvas px-5 py-2 lg:px-8" aria-label={t('monthly.days')}>
      {data.results.map((day) => {
        const date = parseValue(day.date);
        return (
          <li
            key={day.date}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[14px]"
          >
            <span className="w-36 flex-none font-medium">{date ? f.weekday(date) : day.date}</span>
            <span className="w-28 flex-none text-text-2">
              {day.check_in ? f.time(day.check_in) : '—'}
              {' – '}
              {day.check_out ? f.time(day.check_out) : '—'}
            </span>
            <span className="w-14 flex-none">
              {day.check_out ? f.digits(clockOf(day.worked_seconds)) : ''}
            </span>
            <Chip tone={STATUS_TONE[day.status]} dot small>
              {t(`status.${day.status}`)}
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}
