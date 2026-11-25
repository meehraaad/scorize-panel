import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';

export function ReportTable({
  columns,
  rows,
  labelledBy,
}: {
  columns: readonly string[];
  rows: readonly { key: string; cells: readonly ReactNode[] }[];
  labelledBy: string;
}) {
  const { t } = useTranslation('telemetry');
  if (!rows.length) {
    return (
      <EmptyState variant="inset" icon="chart">
        {t('empty')}
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby={labelledBy}>
      <table className="w-full text-start text-sm tabular-nums" aria-labelledby={labelledBy}>
        <thead className="bg-canvas text-text-2">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 text-start font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={columns[index]} className="px-4 py-3 text-start align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
