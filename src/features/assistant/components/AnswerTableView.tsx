import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import type { AnswerTable } from '../api';

/**
 * A table under an answer: what a query found, shown to the founder only (names and phone numbers
 * included); the model read just the totals. Scrolls sideways when wide.
 */
export function AnswerTableView({ table }: { table: AnswerTable }) {
  const { t } = useTranslation('assistant');
  const f = useFormat();
  const titleId = useId();

  const cell = (value: AnswerTable['rows'][number][string] | undefined) => {
    if (value === null || value === undefined || value === '') return t('table.empty');
    if (typeof value === 'boolean') return t(value ? 'table.yes' : 'table.no');
    if (typeof value === 'number') return f.number(value);
    return value;
  };

  return (
    <section
      aria-labelledby={titleId}
      className="flex w-full flex-col gap-2 rounded-2xl bg-surface p-3 shadow-[inset_0_0_0_1px_var(--line-2)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 id={titleId} className="m-0 text-sm font-bold">
          {table.title}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-2">
          <Icon name="lock" size={14} />
          {t('table.private')}
        </span>
      </div>
      <div className="max-h-[420px] overflow-x-auto overflow-y-auto overscroll-contain">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-2.5 py-2 text-start font-semibold whitespace-nowrap text-text-2 shadow-[inset_0_-1px_0_var(--hair)]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {table.columns.map((column) => (
                  <td key={column.key} className="px-2.5 py-2 whitespace-nowrap">
                    <bdi>{cell(row[column.key])}</bdi>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 px-1 text-xs text-text-2">
        {table.truncated
          ? t('table.truncated', { rows: f.number(table.rows.length) })
          : t('table.rows', { rows: f.number(table.rows.length) })}
      </p>
    </section>
  );
}
