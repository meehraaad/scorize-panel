import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useFormat } from '@/lib/i18n/useFormat';
import { maskPhone } from '@/lib/sales/api';
import type { LeadRow } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';
import { ContactButtons } from './ContactButtons';
import { ScoreChip, StageChip } from './LeadChips';

const COLUMNS = ['customer', 'source', 'score', 'stage', 'next'] as const;

const cell = 'px-3 py-4 align-middle first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';

/** The leads list as a table (scrolls sideways on phones), with row selection for bulk actions. */
export function LeadTable({
  rows,
  selected,
  onSelect,
}: {
  rows: LeadRow[];
  selected: ReadonlySet<number>;
  onSelect: (selected: ReadonlySet<number>) => void;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const all = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const toggle = (id: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-start">
        <thead>
          <tr className="text-[13px] font-medium text-text-2 shadow-[inset_0_-1px_0_var(--hair)]">
            <th scope="col" className={`${cell} w-10 py-3`}>
              <input
                type="checkbox"
                aria-label={t('leads.selectAll')}
                checked={all}
                onChange={(event) =>
                  onSelect(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())
                }
                className="size-[18px] accent-primary"
              />
            </th>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={`${cell} py-3 text-start font-medium`}>
                {t(`leads.column.${column}`)}
              </th>
            ))}
            <th scope="col" className={`${cell} py-3`}>
              <span className="sr-only">{t('leads.column.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const due = s.due(row.follow_up_at, row.stage, row.last_contact !== null);
            const meta = [
              row.degree !== null ? tc(`degree.${row.degree}`) : null,
              row.countries.length ? f.list(row.countries) : null,
              f.digits(maskPhone(row.phone)),
            ].filter(Boolean);
            return (
              <tr
                key={row.id}
                className={`shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas ${selected.has(row.id) ? 'bg-row-highlight' : ''}`}
              >
                <td className={cell}>
                  <input
                    type="checkbox"
                    aria-label={t('leads.select', { name: row.name })}
                    checked={selected.has(row.id)}
                    onChange={(event) => toggle(row.id, event.target.checked)}
                    className="size-[18px] accent-primary"
                  />
                </td>
                <td className={cell}>
                  <span className="flex flex-col gap-1">
                    <Link
                      to={customerPath(row.customer)}
                      className="text-base font-semibold text-text hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="text-[13px] text-text-2">{meta.join(' · ')}</span>
                  </span>
                </td>
                <td className={cell}>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{t(`source.${row.source}`)}</span>
                    <span className="text-[13px] leading-6 text-text-2">{row.cause}</span>
                  </span>
                </td>
                <td className={cell}>
                  <ScoreChip score={row.score} />
                </td>
                <td className={cell}>
                  <span className="flex flex-col items-start gap-1">
                    <StageChip stage={row.stage} />
                    {row.lost_reason && (
                      <span className="text-xs text-text-2">
                        {t('leads.lostWhy', { reason: t(`lost.${row.lost_reason}`) })}
                      </span>
                    )}
                  </span>
                </td>
                <td className={cell}>
                  <span className="flex flex-col gap-1">
                    <span
                      className={`text-sm font-semibold ${due.urgent ? 'text-urgent' : 'text-text'}`}
                    >
                      {due.text}
                    </span>
                    <span className="text-[13px] text-text-2">
                      {t('lastContact', {
                        text: row.last_contact
                          ? t('lastContactAgo', {
                              when: f.timeAgo(row.last_contact.at),
                              text: row.last_contact.summary,
                            })
                          : t('noContact'),
                      })}
                    </span>
                  </span>
                </td>
                <td className={`${cell} text-end`}>
                  <ContactButtons
                    customer={row.customer}
                    name={row.name}
                    phone={row.phone}
                    messages={false}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
