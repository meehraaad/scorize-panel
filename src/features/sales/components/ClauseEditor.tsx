import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextAreaField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ClauseEdit, StandardClause } from '../api';

/** One clause as the list shows it: a standard one (with this customer's edit) or one added. */
interface Row {
  key: string;
  base: StandardClause | null;
  edit: ClauseEdit | null;
}

/**
 * The contract's clauses for this customer (S51): the standard contract, where the seller changes,
 * removes or adds clauses as agreed with the customer. Only the differences are kept, and the
 * sales manager reviews only those.
 */
export function ClauseEditor({
  standard,
  edits,
  onChange,
}: {
  standard: StandardClause[];
  edits: ClauseEdit[];
  onChange: (edits: ClauseEdit[]) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [editing, setEditing] = useState<string | null>(null);

  const added = edits.filter((edit) => edit.clause === null);
  const rows: Row[] = [
    ...standard.map((base) => ({
      key: `s${String(base.id)}`,
      base,
      edit: edits.find((edit) => edit.clause === base.id) ?? null,
    })),
    ...added.map((edit, index) => ({ key: `a${String(index)}`, base: null, edit })),
  ];
  const changed = edits.filter((edit) => edit.clause !== null).length;

  /** Replaces `row`'s edit; an edit that leaves a standard clause as it is drops out. */
  const update = (row: Row, next: ClauseEdit | null) => {
    const same =
      next &&
      row.base &&
      !next.removed &&
      next.title === row.base.title &&
      next.text === row.base.text;
    const kept = edits.filter((edit) => edit !== row.edit);
    onChange(
      next && !same
        ? row.edit
          ? edits.map((edit) => (edit === row.edit ? next : edit))
          : [...kept, next]
        : kept,
    );
  };

  const editOf = (row: Row): ClauseEdit =>
    row.edit ?? {
      clause: row.base?.id ?? null,
      title: row.base?.title ?? '',
      text: row.base?.text ?? '',
      removed: false,
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
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => {
          const edit = editOf(row);
          const removed = row.edit?.removed ?? false;
          const name = edit.title || t('offer.clauses.untitled', { n: f.number(index + 1) });
          const open = editing === row.key;
          // A fixed clause (S64) stays as the manager wrote it.
          const locked = row.base?.locked ?? false;
          return (
            <li
              key={row.key}
              className={`flex flex-col gap-2.5 rounded-2xl p-4 ${row.edit ? 'bg-warn-tint shadow-[inset_0_0_0_1.5px_var(--warn)]' : 'shadow-[inset_0_0_0_1px_var(--line-2)]'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-sm font-bold ${removed ? 'text-text-2 line-through' : ''}`}>
                  {f.number(index + 1)}. {name}
                </span>
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
              </div>

              {open && !removed ? (
                <div className="flex flex-col gap-3">
                  <TextField
                    label={t('offer.clauses.title')}
                    value={edit.title}
                    onChange={(event) => update(row, { ...edit, title: event.target.value })}
                  />
                  <TextAreaField
                    label={t('offer.clauses.text')}
                    rows={5}
                    value={edit.text}
                    onChange={(event) => update(row, { ...edit, text: event.target.value })}
                  />
                </div>
              ) : (
                <p
                  className={`m-0 text-sm leading-7 whitespace-pre-line ${removed ? 'text-text-2 line-through' : open ? '' : 'line-clamp-3'}`}
                >
                  {edit.text}
                </p>
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
                      {t('offer.clauses.restore', { name: row.base.title })}
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
          );
        })}
      </ol>
      <div>
        <Button
          variant="outline"
          onClick={() => {
            onChange([...edits, { clause: null, title: '', text: '', removed: false }]);
            setEditing(`a${String(added.length)}`);
          }}
        >
          {t('offer.clauses.add')}
        </Button>
      </div>
    </div>
  );
}
