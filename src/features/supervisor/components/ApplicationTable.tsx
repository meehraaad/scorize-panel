import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { daysUntil, isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import type { CaseApplication } from '../api';
import { ResultChip } from './Chips';
import { URGENT_DAYS } from './DeadlineBoard';

const COLUMNS = ['university', 'program', 'deadline', 'fee', 'result', 'approval'] as const;
const cell = 'px-3 py-4 align-middle first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';

/** The case's applications, soonest deadline first; each row opens the side editor. */
export function ApplicationTable({
  applications,
  onEdit,
}: {
  applications: readonly CaseApplication[];
  onEdit: (application: CaseApplication) => void;
}) {
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const sorted = applications.toSorted(
    (a, b) =>
      (a.deadline ? new Date(a.deadline).getTime() : Infinity) -
      (b.deadline ? new Date(b.deadline).getTime() : Infinity),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-start">
        <thead>
          <tr className="text-[13px] font-medium text-text-2 shadow-[inset_0_-1px_0_var(--hair)]">
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={`${cell} py-3 text-start font-medium`}>
                {t(`applications.column.${column}`)}
              </th>
            ))}
            <th scope="col" className={`${cell} py-3`}>
              <span className="sr-only">{t('applications.column.edit')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((app) => {
            const past = app.deadline !== null && isPast(app.deadline);
            const days = app.deadline ? daysUntil(app.deadline) : null;
            const soon = days !== null && !past && days <= URGENT_DAYS && !app.result;
            return (
              <tr
                key={app.id}
                className={`shadow-[inset_0_1px_0_var(--hair)] ${soon ? 'bg-row-highlight' : ''}`}
              >
                <td className={`${cell} text-[15px] font-semibold`}>
                  <bdi>{app.university}</bdi>
                </td>
                <td className={cell}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm">
                      <bdi>{app.program}</bdi>
                    </span>
                    <span className="text-xs text-text-2">{tc(`degree.${app.degree}`)}</span>
                  </span>
                </td>
                <td className={cell}>
                  {app.deadline ? (
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm">{f.date(app.deadline)}</span>
                      <span
                        className={`text-xs ${soon ? 'font-semibold text-danger' : 'text-text-2'}`}
                      >
                        {past
                          ? t('applications.past')
                          : t('applications.daysLeft', { n: f.number(days ?? 0) })}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-3">{t('dash')}</span>
                  )}
                </td>
                <td className={cell}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm tabular-nums">
                      {app.fee ? f.money(app.fee.amount, app.fee.currency) : t('dash')}
                    </span>
                    {app.payment && (
                      <span
                        className={`text-xs ${
                          app.payment === 'pending'
                            ? 'text-warn'
                            : app.payment === 'paid'
                              ? 'text-good'
                              : 'text-text-2'
                        }`}
                      >
                        {t(`payment.${app.payment}`)}
                      </span>
                    )}
                  </span>
                </td>
                <td className={cell}>
                  <ResultChip result={app.result} />
                </td>
                <td
                  className={`${cell} text-sm ${
                    app.approval === 'approved'
                      ? 'text-good'
                      : app.approval === 'rejected'
                        ? 'text-danger'
                        : 'text-warn'
                  }`}
                >
                  {t(`approval.${app.approval}`)}
                </td>
                <td className={`${cell} text-end`}>
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    onClick={() => onEdit(app)}
                    aria-label={t('applications.editLabel', { name: app.university })}
                  >
                    {t('applications.edit')}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
