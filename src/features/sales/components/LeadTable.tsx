import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { FaceDot } from '@/components/customers/FaceDot';
import { TagList } from '@/components/ui/Tags';
import { useFormat } from '@/lib/i18n/useFormat';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { maskPhone } from '@/lib/sales/api';
import { tagsOf, type CustomerTag, type LeadRow } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';
import { ContactButtons } from './ContactButtons';
import { ScoreChip, StageChip } from './LeadChips';
import { OwnerTag } from './OwnerTag';

const COLUMNS = ['customer', 'source', 'score', 'stage', 'next'] as const;

const cell = 'px-3 py-4 align-middle first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';

/**
 * The leads list, with row selection for bulk actions: a table on desktops, a list of cards on
 * phones and tablets (a table there only scrolled sideways and pushed the page wider than the screen).
 */
export function LeadTable({
  rows,
  selected,
  onSelect,
  selectable,
  tags,
}: {
  rows: LeadRow[];
  selected: ReadonlySet<number>;
  onSelect: (selected: ReadonlySet<number>) => void;
  /** Checkboxes for bulk changes, when the server takes them. */
  selectable: boolean;
  /** The team's tags, to name each row's (S49); none while the server has no tags. */
  tags?: readonly CustomerTag[] | undefined;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const wide = useMediaQuery(DESKTOP_QUERY);
  const all = rows.length > 0 && rows.every((row) => selected.has(row.id));
  // No score column while no lead has one (Django has no lead score yet: S5).
  const scored = rows.some((row) => row.score !== null);
  const columns = COLUMNS.filter((column) => column !== 'score' || scored);

  const toggle = (id: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  if (!wide)
    return (
      <ul aria-label={t('leads.list')} className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => {
          const due = s.due(
            row.follow_up_at,
            row.stage,
            row.last_contact !== null || row.stage !== 'new',
          );
          const meta = [
            row.degree !== null ? tc(`degree.${row.degree}`) : null,
            row.countries.length ? f.list(row.countries) : null,
            f.digits(maskPhone(row.phone)),
          ].filter(Boolean);
          const rowTags = tagsOf(row.tags, tags);
          const toneOf = new Map(rowTags.map((tag) => [tag.name, tag.tone]));
          return (
            <li
              key={row.id}
              className={`flex gap-3 px-4 py-4 shadow-[inset_0_-1px_0_var(--hair)] last:shadow-none ${selected.has(row.id) ? 'bg-row-highlight' : ''}`}
            >
              {selectable && (
                <input
                  type="checkbox"
                  aria-label={t('leads.select', { name: row.name })}
                  checked={selected.has(row.id)}
                  onChange={(event) => toggle(row.id, event.target.checked)}
                  className="mt-1 size-[18px] flex-none accent-primary"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <Link
                      to={customerPath(row.customer)}
                      className="inline-flex items-center gap-2 text-base font-semibold break-words text-text hover:underline"
                    >
                      <FaceDot name={row.name} face={row.face} />
                      {row.name}
                    </Link>
                    <span className="text-[13px] break-words text-text-2">{meta.join(' · ')}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1">
                    <StageChip stage={row.stage} />
                    {row.score !== null && <ScoreChip score={row.score} />}
                  </span>
                </div>
                <OwnerTag seller={row.seller} />
                {rowTags.length > 0 && (
                  <TagList
                    label={t('tags.of', { name: row.name })}
                    tags={rowTags.map((tag) => tag.name)}
                    toneOf={(name) => toneOf.get(name) ?? 'neutral'}
                    size="sm"
                    latin={false}
                  />
                )}
                <span className="text-[13px] leading-6 break-words text-text-2">
                  <span className="font-medium text-text">{t(`source.${row.source}`)}</span>
                  {row.cause && ` · ${row.cause}`}
                </span>
                {row.lost_reason && (
                  <span className="text-xs text-text-2">
                    {t('leads.lostWhy', { reason: t(`lost.${row.lost_reason}`) })}
                  </span>
                )}
                <div className="flex items-end justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={`text-sm font-semibold ${due.urgent ? 'text-urgent' : 'text-text'}`}
                    >
                      {due.text}
                    </span>
                    {(row.last_contact || row.stage === 'new') && (
                      <span className="text-[13px] break-words text-text-2">
                        {t('lastContact', {
                          text: row.last_contact
                            ? t('lastContactAgo', {
                                when: f.timeAgo(row.last_contact.at),
                                text: row.last_contact.summary,
                              })
                            : t('noContact'),
                        })}
                      </span>
                    )}
                  </span>
                  <ContactButtons
                    customer={row.customer}
                    name={row.name}
                    phone={row.phone}
                    messages={false}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-start">
        <thead>
          <tr className="text-[13px] font-medium text-text-2 shadow-[inset_0_-1px_0_var(--hair)]">
            {selectable && (
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
            )}
            {columns.map((column) => (
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
            const due = s.due(
              row.follow_up_at,
              row.stage,
              row.last_contact !== null || row.stage !== 'new',
            );
            const meta = [
              row.degree !== null ? tc(`degree.${row.degree}`) : null,
              row.countries.length ? f.list(row.countries) : null,
              f.digits(maskPhone(row.phone)),
            ].filter(Boolean);
            const rowTags = tagsOf(row.tags, tags);
            const toneOf = new Map(rowTags.map((tag) => [tag.name, tag.tone]));
            return (
              <tr
                key={row.id}
                className={`shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas ${selected.has(row.id) ? 'bg-row-highlight' : ''}`}
              >
                {selectable && (
                  <td className={cell}>
                    <input
                      type="checkbox"
                      aria-label={t('leads.select', { name: row.name })}
                      checked={selected.has(row.id)}
                      onChange={(event) => toggle(row.id, event.target.checked)}
                      className="size-[18px] accent-primary"
                    />
                  </td>
                )}
                <td className={cell}>
                  <span className="flex flex-col gap-1">
                    <Link
                      to={customerPath(row.customer)}
                      className="inline-flex items-center gap-2 text-base font-semibold text-text hover:underline"
                    >
                      <FaceDot name={row.name} face={row.face} />
                      {row.name}
                    </Link>
                    <span className="text-[13px] text-text-2">{meta.join(' · ')}</span>
                    <OwnerTag seller={row.seller} />
                    {rowTags.length > 0 && (
                      <TagList
                        label={t('tags.of', { name: row.name })}
                        tags={rowTags.map((tag) => tag.name)}
                        toneOf={(name) => toneOf.get(name) ?? 'neutral'}
                        size="sm"
                        latin={false}
                      />
                    )}
                  </span>
                </td>
                <td className={cell}>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{t(`source.${row.source}`)}</span>
                    <span className="text-[13px] leading-6 text-text-2">{row.cause}</span>
                  </span>
                </td>
                {scored && (
                  <td className={cell}>{row.score !== null && <ScoreChip score={row.score} />}</td>
                )}
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
                      {(row.last_contact || row.stage === 'new') &&
                        t('lastContact', {
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
