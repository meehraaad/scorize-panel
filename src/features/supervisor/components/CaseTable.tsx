import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { CaseRow } from '../api';
import { casePath } from '../paths';
import { StageChip, WritingCell } from './Chips';
import { useCaseLine } from './useCaseLine';

const COLUMNS = ['applicant', 'stage', 'contract', 'cv', 'sop', 'bot', 'docs', 'activity'] as const;

const cell = 'px-3 py-4 align-middle first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';

/** Every case as a table (scrolls sideways on phones), with row selection for the export. */
export function CaseTable({
  rows,
  selected,
  onSelect,
}: {
  rows: readonly CaseRow[];
  selected: ReadonlySet<number>;
  onSelect: (selected: ReadonlySet<number>) => void;
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const line = useCaseLine();
  const all = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const toggle = (id: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-start">
        <thead>
          <tr className="text-[13px] font-medium text-text-2 shadow-[inset_0_-1px_0_var(--hair)]">
            <th scope="col" className={`${cell} w-10 py-3`}>
              <input
                type="checkbox"
                aria-label={t('cases.selectAll')}
                checked={all}
                onChange={(event) =>
                  onSelect(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())
                }
                className="size-[18px] accent-primary"
              />
            </th>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={`${cell} py-3 text-start font-medium`}>
                {t(`cases.column.${column}`)}
              </th>
            ))}
            <th scope="col" className={`${cell} py-3`}>
              <span className="sr-only">{t('cases.column.open')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas ${
                selected.has(row.id) ? 'bg-row-highlight' : ''
              }`}
            >
              <td className={cell}>
                <input
                  type="checkbox"
                  aria-label={t('cases.select', { name: row.name })}
                  checked={selected.has(row.id)}
                  onChange={(event) => toggle(row.id, event.target.checked)}
                  className="size-[18px] accent-primary"
                />
              </td>
              <td className={cell}>
                <span className="flex flex-col gap-1">
                  <Link
                    to={casePath(row.id)}
                    className="text-base font-semibold text-text hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="text-[13px] text-text-2">{line(row)}</span>
                </span>
              </td>
              <td className={cell}>
                <StageChip stage={row.stage} small />
              </td>
              <td className={`${cell} text-sm text-text-2`}>{row.contract}</td>
              <td className={cell}>
                <WritingCell state={row.cv} />
              </td>
              <td className={cell}>
                <WritingCell state={row.sop} />
              </td>
              <td className={cell}>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm ${row.bot ? 'text-good' : 'text-text-2'}`}
                >
                  <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
                  {t(row.bot ? 'bot.on' : 'bot.off')}
                </span>
              </td>
              <td className={cell}>
                <span className="flex items-center gap-2">
                  <ProgressBar
                    size="sm"
                    className="w-16"
                    value={percentOf(row.docs.uploaded, row.docs.required)}
                    tone={row.docs.uploaded >= row.docs.required ? 'good' : 'primary'}
                  />
                  <span className="text-sm whitespace-nowrap text-text-2">
                    {t('docsShort', {
                      uploaded: f.number(row.docs.uploaded),
                      required: f.number(row.docs.required),
                    })}
                  </span>
                </span>
              </td>
              <td className={`${cell} text-sm whitespace-nowrap text-text-2`}>
                {f.timeAgo(row.last_activity)}
              </td>
              <td className={`${cell} text-end`}>
                <Link
                  to={casePath(row.id)}
                  aria-label={t('cases.open', { name: row.name })}
                  className="inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-canvas"
                >
                  <Icon name="chevronEnd" size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
