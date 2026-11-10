import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import {
  numberClauses,
  textParts,
  useClauseLabel,
  type ClauseKind,
  type ClauseNumber,
} from '@/lib/contractText';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ClauseEdit, StandardClause } from '../api';

/** One clause as the list shows it: a standard one (with this customer's edit) or one added. */
interface Row {
  key: string;
  base: StandardClause | null;
  edit: ClauseEdit | null;
}

const ADDED_KINDS = ['clause', 'note'] as const;

/** A clause's text, its variables standing out: filled with the seller's value, or `[name]`. */
function Text({ text, values }: { text: string; values: Record<string, string> }) {
  return (
    <>
      {textParts(text, values).map((part, index) =>
        part.variable === undefined ? (
          part.text
        ) : (
          <mark
            key={index}
            className={`rounded px-1 ${part.missing ? 'bg-canvas text-text-2' : 'bg-tint text-primary-text'}`}
          >
            {part.text}
          </mark>
        ),
      )}
    </>
  );
}

/**
 * The contract's text for this customer (S51, S69): the kind of contract's articles, clauses and
 * notes, where the seller changes, removes or adds them as agreed with the customer. A clause
 * added goes into the article it is added to. Only the differences are kept, and the sales manager
 * reviews only those.
 */
export function ClauseEditor({
  standard,
  edits,
  onChange,
  values = {},
}: {
  standard: StandardClause[];
  edits: ClauseEdit[];
  onChange: (edits: ClauseEdit[]) => void;
  /** The seller's values of the kind of contract's blanks (S69), shown in the text. */
  values?: Record<string, string>;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const label = useClauseLabel();
  const [editing, setEditing] = useState<string | null>(null);

  const added = edits.filter((edit) => edit.clause === null);
  const known = (id: number | null) => id !== null && standard.some((base) => base.id === id);
  const addedRow = (edit: ClauseEdit) => ({
    key: `a${String(added.indexOf(edit))}`,
    base: null,
    edit,
  });
  // In the contract's order: each standard clause, then the clauses added after it.
  const rows: Row[] = [
    ...standard.flatMap((base) => [
      {
        key: `s${String(base.id)}`,
        base,
        edit: edits.find((edit) => edit.clause === base.id) ?? null,
      },
      ...added.filter((edit) => edit.after === base.id).map(addedRow),
    ]),
    ...added.filter((edit) => !known(edit.after)).map(addedRow),
  ];
  const changed = edits.filter((edit) => edit.clause !== null).length;

  const kindOfRow = (row: Row): ClauseKind => row.base?.kind ?? row.edit?.kind ?? 'clause';
  const isRemoved = (row: Row) => row.edit?.removed ?? false;
  // Numbered as the contract will print: removed clauses count for nothing.
  const kept = rows.filter((row) => !isRemoved(row));
  const numbers = new Map<string, ClauseNumber>(
    numberClauses(kept.map((row) => ({ kind: kindOfRow(row) }))).map((number, index) => [
      kept[index]?.key ?? '',
      number,
    ]),
  );

  /** Replaces `row`'s edit; an edit that leaves a standard clause as it is drops out. */
  const update = (row: Row, next: ClauseEdit | null) => {
    const same =
      next &&
      row.base &&
      !next.removed &&
      next.title === row.base.title &&
      next.text === row.base.text;
    const others = edits.filter((edit) => edit !== row.edit);
    onChange(
      next && !same
        ? row.edit
          ? edits.map((edit) => (edit === row.edit ? next : edit))
          : [...others, next]
        : others,
    );
  };

  const editOf = (row: Row): ClauseEdit =>
    row.edit ?? {
      clause: row.base?.id ?? null,
      kind: row.base?.kind ?? 'clause',
      title: row.base?.title ?? '',
      text: row.base?.text ?? '',
      removed: false,
      after: null,
    };

  /** Adds a clause at the end of the article `after` is in (null: a new article at the end). */
  const add = (kind: ClauseKind, after: number | null) => {
    onChange([...edits, { clause: null, kind, title: '', text: '', removed: false, after }]);
    setEditing(`a${String(added.length)}`);
  };

  /**
   * After the last row of each article, its "add a clause" button: a clause added there goes after
   * the article's last standard clause.
   */
  const anchors = new Map<string, number>();
  let lastStandard: number | null = null;
  rows.forEach((row, index) => {
    if (row.base) lastStandard = row.base.id;
    const next = rows[index + 1];
    if (lastStandard !== null && (!next || kindOfRow(next) === 'article'))
      anchors.set(row.key, lastStandard);
  });

  const nameOf = (row: Row, edit: ClauseEdit) => {
    const number = numbers.get(row.key);
    if (!number) return edit.title || edit.text.slice(0, 30);
    return number.kind === 'article' && edit.title
      ? `${label(number)}: ${edit.title}`
      : label(number);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] leading-6 text-text-2">
        {standard.length ? t('offer.clauses.hint') : t('offer.clauses.noStandard')}
      </p>
      {(changed > 0 || added.length > 0) && (
        <p className="m-0 text-sm font-semibold">
          {t('offer.clauses.count', { changed: f.number(changed), added: f.number(added.length) })}
        </p>
      )}
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((row) => {
          const edit = editOf(row);
          const removed = isRemoved(row);
          const kind = kindOfRow(row);
          const name = nameOf(row, edit);
          const open = editing === row.key;
          // A fixed clause (S64) stays as the manager wrote it.
          const locked = row.base?.locked ?? false;
          const article = kind === 'article';
          const end = anchors.get(row.key) ?? null;
          return (
            <Fragment key={row.key}>
              <li
                className={`flex flex-col gap-2.5 rounded-2xl p-4 ${article ? '' : 'ms-4'} ${row.edit ? 'bg-warn-tint shadow-[inset_0_0_0_1.5px_var(--warn)]' : 'shadow-[inset_0_0_0_1px_var(--line-2)]'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-sm ${article ? 'font-extrabold' : 'font-bold'} ${removed ? 'text-text-2 line-through' : ''}`}
                  >
                    {name}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {locked && (
                      <Chip tone="neutral" small>
                        {t('offer.clauses.locked')}
                      </Chip>
                    )}
                    {row.edit && (
                      <Chip tone={removed ? 'danger' : 'warn'} small>
                        {t(
                          `offer.clauses.state.${removed ? 'removed' : row.base ? 'changed' : 'added'}`,
                        )}
                      </Chip>
                    )}
                  </span>
                </div>

                {open && !removed ? (
                  <div className="flex flex-col gap-3">
                    {row.base === null && !article && (
                      <ChoiceGroup
                        legend={t('offer.clauses.kind')}
                        look="segmented"
                        options={ADDED_KINDS.map((value) => ({
                          value,
                          label: tc(`clauseNumber.kinds.${value}`),
                        }))}
                        value={kind}
                        onChange={(value) => update(row, { ...edit, kind: value })}
                      />
                    )}
                    {article && (
                      <TextField
                        label={t('offer.clauses.title')}
                        value={edit.title}
                        onChange={(event) => update(row, { ...edit, title: event.target.value })}
                      />
                    )}
                    <TextAreaField
                      label={t('offer.clauses.text')}
                      rows={4}
                      value={edit.text}
                      onChange={(event) => update(row, { ...edit, text: event.target.value })}
                    />
                  </div>
                ) : (
                  edit.text && (
                    <p
                      className={`m-0 text-sm leading-7 whitespace-pre-line ${removed ? 'text-text-2 line-through' : open ? '' : 'line-clamp-3'}`}
                    >
                      <Text text={edit.text} values={values} />
                    </p>
                  )
                )}

                {!locked && (
                  <div className="flex flex-wrap gap-2">
                    {!removed && (
                      <Button
                        variant="outline"
                        aria-expanded={open}
                        onClick={() => setEditing(open ? null : row.key)}
                      >
                        {open ? t('offer.clauses.done') : t('offer.clauses.edit', { name })}
                      </Button>
                    )}
                    {row.base && row.edit && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          update(row, null);
                          setEditing(null);
                        }}
                      >
                        {t('offer.clauses.restore', { name })}
                      </Button>
                    )}
                    {!removed && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          update(
                            row,
                            row.base ? { ...editOf({ ...row, edit: null }), removed: true } : null,
                          );
                          setEditing(null);
                        }}
                      >
                        {t('offer.clauses.remove', { name })}
                      </Button>
                    )}
                  </div>
                )}
              </li>
              {end !== null && (
                <li className="ms-4">
                  <Button variant="outline" onClick={() => add('clause', end)}>
                    {t('offer.clauses.addHere')}
                  </Button>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      <div>
        <Button variant="outline" onClick={() => add(standard.length ? 'article' : 'clause', null)}>
          {standard.length ? t('offer.clauses.addArticle') : t('offer.clauses.add')}
        </Button>
      </div>
    </div>
  );
}
