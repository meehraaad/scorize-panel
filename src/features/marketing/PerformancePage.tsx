import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { fromCalendar, monthGrid, toCalendar, toValue } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { attendanceQuery, monthRange, type AttendanceDay, type MyAttendance } from './api';
import { clockOf } from './format';

const CELL_TONE: Record<AttendanceDay['status'], string> = {
  present: 'bg-good-tint text-good',
  late: 'bg-warn-tint text-warn',
  absent: 'bg-danger-tint text-danger',
  pending: 'bg-neutral-tint text-neutral',
};

/**
 * My performance (canvas "عملکرد و حضور من"): the month's attendance from the office terminal,
 * day by day and in total, and a place kept for KPIs (they come with the company-wide KPI system).
 */
export default function PerformancePage() {
  const { t } = useTranslation('marketing');
  const cal = useCalendar();
  const [shift, setShift] = useState(0);
  const range = monthRange(cal.kind, shift);
  const { data, isPending } = useQuery(attendanceQuery(range));
  const f = useFormat();
  const monthName = f.monthYear(
    fromCalendar({ year: range.year, month: range.month, day: 1 }, cal.kind),
  );

  return (
    <PageStack>
      <PageHeader title={t('performance.title')} subtitle={t('performance.subtitle')} />
      <SectionCard
        id="marketing-kpi"
        title={t('performance.kpi')}
        badge={
          <Chip tone="info" small>
            {t('performance.kpiSoon')}
          </Chip>
        }
      >
        <EmptyState variant="inset" icon="chart">
          {t('performance.kpiEmpty')}
        </EmptyState>
      </SectionCard>
      <SectionCard
        id="marketing-attendance"
        title={t('performance.attendance')}
        subtitle={monthName}
        end={
          <span className="flex items-center gap-1">
            <IconButton
              icon="chevronStart"
              aria-label={t('performance.previous')}
              onClick={() => setShift((value) => value - 1)}
            />
            <IconButton
              icon="chevronEnd"
              aria-label={t('performance.next')}
              disabled={shift >= 0}
              onClick={() => setShift((value) => value + 1)}
            />
          </span>
        }
      >
        <div className="px-5 pb-5 lg:px-8 lg:pb-7">
          {isPending || !data ? (
            <SkeletonRows rows={4} />
          ) : !data.device ? (
            <EmptyState variant="inset" icon="clock">
              {t('performance.noDevice')}
            </EmptyState>
          ) : (
            <Month data={data} year={range.year} month={range.month} name={monthName} />
          )}
        </div>
      </SectionCard>
    </PageStack>
  );
}

function Month({
  data,
  year,
  month,
  name,
}: {
  data: MyAttendance;
  year: number;
  month: number;
  name: string;
}) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const cal = useCalendar();
  const { totals } = data;
  const byDay = new Map(data.days.map((day) => [day.day, day]));
  const weeks = monthGrid(year, month, cal.kind);
  const inMonth = (date: Date) => toCalendar(date, cal.kind).month === month;

  return (
    <div className="flex flex-col gap-5">
      <StatGrid
        compact
        label={t('performance.totals')}
        stats={[
          { label: t('performance.present'), value: f.number(totals.days_present), tone: 'good' },
          {
            label: t('performance.worked'),
            value: t('performance.hours', { time: f.digits(clockOf(totals.worked_seconds)) }),
          },
          {
            label: t('performance.late'),
            value: t('performance.lateDays', { n: f.number(totals.late_days) }),
            note: f.digits(clockOf(totals.late_seconds)),
          },
          { label: t('performance.absent'), value: f.number(totals.absent_days), tone: 'urgent' },
          { label: t('performance.noCheckOut'), value: f.number(totals.missing_check_out_days) },
        ]}
      />
      <table className="w-full table-fixed border-separate border-spacing-1.5">
        <caption className="sr-only">{t('performance.month', { month: name })}</caption>
        <thead>
          <tr>
            {(weeks[0] ?? []).map((date) => (
              <th
                key={date.toISOString()}
                scope="col"
                abbr={cal.weekdayLong.format(date)}
                className="text-xs font-normal text-text-2"
              >
                {cal.weekday.format(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks
            .filter((week) => week.some(inMonth))
            .map((week) => (
              <tr key={week[0]?.toISOString()}>
                {week.map((date) => {
                  if (!inMonth(date)) return <td key={date.toISOString()} />;
                  const row = byDay.get(toValue(date, false));
                  // Colour is never the only sign: present days show the time in, the others say what they were.
                  const line = row
                    ? row.status === 'present' && row.check_in
                      ? f.time(row.check_in)
                      : t(`status.${row.status}`)
                    : '';
                  return (
                    <td
                      key={date.toISOString()}
                      className={`h-14 rounded-xl p-0 text-center align-middle ${
                        row ? CELL_TONE[row.status] : 'bg-canvas text-text-2'
                      }`}
                    >
                      <span className="sr-only">{f.dateShort(date)}</span>
                      <span aria-hidden="true" className="block text-sm font-semibold">
                        {f.number(toCalendar(date, cal.kind).day)}
                      </span>
                      {line && <span className="block truncate px-0.5 text-[11px]">{line}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
