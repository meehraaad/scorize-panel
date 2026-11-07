import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ListRow } from '@/lib/schedule';

/**
 * The schedule's list shape: a day as rows by the hour (today's timetable), each row's time
 * beside it, a red line at now, and a dashed hint where a long free stretch is ahead. The rows
 * come from `listRowsOf` (`@/lib/schedule`); what a row and a free stretch show is the caller's.
 */
export function ScheduleList<T>({
  rows,
  now,
  keyOf,
  timeOf,
  renderItem,
  renderFree,
}: {
  rows: readonly ListRow<T>[];
  now: number;
  keyOf: (item: T) => string;
  /** When the row starts (ms), shown beside it. */
  timeOf: (item: T) => number;
  renderItem: (item: T) => ReactNode;
  /** Inside the dashed hint ("2 free hours · call someone"). */
  renderFree: (free: { from: number; minutes: number }) => ReactNode;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {rows.map((row) => {
        if (row.kind === 'now')
          return (
            <li
              key="now"
              aria-label={t('schedule.nowLine', { time: f.time(new Date(now)) })}
              className="flex items-center gap-3 py-2"
            >
              <span className="w-14 flex-none text-xs font-bold text-danger tabular-nums">
                {f.time(new Date(now))}
              </span>
              <span aria-hidden="true" className="relative h-0.5 flex-1 rounded-full bg-danger">
                <span className="absolute -start-1 -top-1 size-2.5 rounded-full bg-danger" />
              </span>
              <span aria-hidden="true" className="text-xs font-bold text-danger">
                {t('schedule.now')}
              </span>
            </li>
          );
        if (row.kind === 'free')
          return (
            <li key={`free-${String(row.from)}`} className="flex gap-3 py-1.5">
              <span className="w-14 flex-none" />
              <span className="flex flex-1 flex-wrap items-center gap-x-3 rounded-2xl border border-dashed border-line-2 px-4 py-1.5">
                {renderFree(row)}
              </span>
            </li>
          );
        return (
          <li key={keyOf(row.item)} className="flex gap-3 py-1.5">
            <span className="w-14 flex-none pt-3.5 text-sm font-semibold text-text-2 tabular-nums">
              {f.time(new Date(timeOf(row.item)))}
            </span>
            <div className="min-w-0 flex-1">{renderItem(row.item)}</div>
          </li>
        );
      })}
    </ol>
  );
}
