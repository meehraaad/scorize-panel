import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ReportsData } from '../api';
import { casePath } from '../paths';

const COLUMNS = ['country', 'submitted', 'accepted', 'rejected', 'waiting', 'rate'] as const;

/** Height of the tallest bar, in px. */
const CHART_HEIGHT = 170;

/**
 * Applications submitted per month (bars) with the admissions among them (the bar's lower part).
 * One scale: admissions are a part of the submitted count. Values are labelled on top of each
 * bar, and each bar's numbers are in its name for screen readers.
 */
export function MonthsChart({ months }: { months: ReportsData['months'] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const max = Math.max(1, ...months.map((month) => month.submitted));
  const describe = (month: ReportsData['months'][number]) =>
    t('reports.months.bar', {
      month: f.month(month.month),
      submitted: f.number(month.submitted),
      accepted: f.number(month.accepted),
    });

  return (
    <SectionCard
      variant="panel"
      size="lg"
      id="report-months"
      title={t('reports.months.title')}
      end={
        <span className="flex gap-4 text-[13px] text-text-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />
            {t('reports.months.submitted')}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-good" />
            {t('reports.months.accepted')}
          </span>
        </span>
      }
    >
      <ol
        aria-label={t('reports.months.title')}
        className="m-0 grid list-none items-end gap-2 p-0 pt-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${String(months.length)}, minmax(0, 1fr))` }}
      >
        {months.map((month) => {
          const height = Math.round((month.submitted / max) * CHART_HEIGHT);
          const accepted = month.submitted ? (month.accepted / month.submitted) * 100 : 0;
          return (
            <li
              key={month.month}
              aria-label={describe(month)}
              title={describe(month)}
              className="flex min-w-0 flex-col items-center gap-2"
            >
              <span aria-hidden="true" className="text-[13px] font-semibold tabular-nums">
                {f.number(month.submitted)}
              </span>
              <span
                aria-hidden="true"
                className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-[4px] bg-primary"
                style={{ height: `${String(Math.max(2, height))}px` }}
              >
                {month.accepted > 0 && (
                  <span
                    className="w-full border-t-2 border-surface bg-good"
                    style={{ height: `${String(accepted)}%` }}
                  />
                )}
              </span>
              <span aria-hidden="true" className="truncate text-xs text-text-2">
                {f.month(month.month)}
              </span>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

/** Results by country this academic year, with the admission rate of the results that came in. */
export function CountryTable({ countries }: { countries: ReportsData['countries'] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const head =
    'px-3 py-3 text-start text-[13px] font-medium whitespace-nowrap text-text-2 first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';
  const cell =
    'px-3 py-3.5 tabular-nums shadow-[inset_0_1px_0_var(--hair)] first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';
  return (
    <SectionCard
      id="report-countries"
      title={t('reports.countries.title')}
      subtitle={t('reports.countries.subtitle')}
    >
      {countries.length === 0 ? (
        <EmptyState variant="padded">{t('reports.countries.empty')}</EmptyState>
      ) : (
        <div className="overflow-x-auto pb-3">
          <table className="w-full min-w-[560px] border-collapse text-[15px]">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className={head}>
                    {t(`reports.countries.column.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {countries.map((row) => {
                const done = row.accepted + row.rejected;
                const rate = done ? Math.round((row.accepted / done) * 100) : null;
                return (
                  <tr key={row.country}>
                    <th scope="row" className={`${cell} text-start font-semibold`}>
                      {row.country}
                    </th>
                    <td className={cell}>{f.number(row.submitted)}</td>
                    <td className={`${cell} text-good`}>{f.number(row.accepted)}</td>
                    <td className={cell}>{f.number(row.rejected)}</td>
                    <td className={`${cell} text-text-2`}>{f.number(row.waiting)}</td>
                    <td className={cell}>
                      {rate === null ? (
                        t('dash')
                      ) : (
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-1.5 w-14 rounded-full bg-track">
                            <span
                              className="block h-1.5 rounded-full bg-good"
                              style={{ width: `${String(rate)}%` }}
                            />
                          </span>
                          {t('reports.percent', { n: f.number(rate) })}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/** Deadlines of the period that passed with the application not sent, and why. */
export function MissedDeadlines({ missed }: { missed: ReportsData['missed'] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  return (
    <SectionCard
      variant="panel"
      size="lg"
      id="report-missed"
      title={t('reports.missed.title')}
      end={
        missed.length > 0 && (
          <span className="text-sm text-danger">
            {t('reports.missed.count', { n: f.number(missed.length) })}
          </span>
        )
      }
    >
      {missed.length === 0 ? (
        <p className="m-0 text-sm leading-7 text-text-2">{t('reports.missed.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {missed.map((item) => (
            <li
              key={item.application}
              className="flex flex-col gap-1.5 rounded-[18px] bg-danger-tint px-4 py-3.5"
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="flex flex-wrap items-baseline gap-x-2.5">
                  <bdi className="text-[15px] font-semibold">{item.university}</bdi>
                  <Link
                    to={casePath(item.applicant.id, 'applications')}
                    className="text-sm font-medium"
                  >
                    {item.applicant.name}
                  </Link>
                </span>
                <span className="text-[13px] text-danger">{f.dateShort(item.deadline)}</span>
              </span>
              <span className="text-sm leading-7 text-text">
                {item.reason ?? t('reports.missed.noReason')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
