import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { dailyQuery, todayValue } from './api';
import { ExportLinks } from './components/ExportLinks';
import { PersonName } from './components/PersonName';
import { STATUS_TONE, clockOf } from './format';

/**
 * One day of the office: who came when (first punch in, last punch out), the hours, and who was
 * late (after the workday start) or absent. Opens on today.
 */
export default function DailyPage() {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  const [day, setDay] = useState(todayValue);
  const range = { from: day, to: day };
  const { data } = useSuspenseQuery(dailyQuery(range));
  const rows = data.results;

  return (
    <PageStack>
      <PageHeader
        title={t('daily.title')}
        subtitle={t('daily.subtitle', { start: f.digits(data.start ?? '–') })}
        actions={<ExportLinks range={range} />}
      />
      <Card aria-label={t('daily.label')}>
        <div className="flex flex-wrap items-end gap-3 px-5 pt-5 lg:px-8">
          <div className="w-full max-w-72">
            <DatePicker
              label={t('daily.date')}
              value={day}
              onChange={(value) => value && setDay(value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={day === todayValue()}
            onClick={() => setDay(todayValue())}
          >
            {t('daily.today')}
          </Button>
        </div>
        {rows.length === 0 ? (
          <EmptyState variant="padded">{t('daily.empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto px-2 pt-3 pb-3 lg:px-4">
            <table className="w-full min-w-[34rem] border-collapse text-start text-[15px]">
              <thead>
                <tr className="text-[13px] text-text-2">
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('daily.person')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('daily.checkIn')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('daily.checkOut')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('daily.hours')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('daily.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${String(row.employee_id)}-${String(row.enroll_id)}`}
                    className="shadow-[inset_0_1px_0_var(--hair)]"
                  >
                    <td className="px-3 py-3">
                      <PersonName
                        name={row.name}
                        employeeId={row.employee_id}
                        enrollId={row.enroll_id}
                      />
                    </td>
                    <td className="px-3 py-3">{row.check_in ? f.time(row.check_in) : '—'}</td>
                    <td className="px-3 py-3">
                      {row.check_out ? (
                        f.time(row.check_out)
                      ) : row.check_in ? (
                        <span className="text-text-2">{t('daily.noCheckOut')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.check_out ? f.digits(clockOf(row.worked_seconds)) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Chip tone={STATUS_TONE[row.status]} dot small>
                        {t(`status.${row.status}`)}
                      </Chip>
                      {row.status === 'late' && (
                        <span className="ms-2 text-[13px] text-text-2">
                          {t('daily.lateBy', { n: f.number(Math.round(row.late_seconds / 60)) })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageStack>
  );
}
