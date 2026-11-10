import type { TextClause } from '@/lib/contractText';
import type { ClauseEdit, StandardClause } from './api';

/**
 * Every clause added has a text, and an article added its title too; a changed clause keeps a text
 * unless it is an article (S69). Django refuses them otherwise.
 */
export const clausesComplete = (edits: ClauseEdit[]) =>
  edits.every((edit) =>
    edit.removed
      ? true
      : edit.clause === null
        ? edit.text.trim() !== '' && (edit.kind !== 'article' || edit.title.trim() !== '')
        : edit.text.trim() !== '' || edit.kind === 'article',
  );

/**
 * This customer's text in order, as Django's `final_clauses` makes it (S69): each standard clause
 * with its edit (the removed ones left out), each followed by the clauses added after it, then the
 * ones added at the end. Variables still named, for the preview to fill.
 */
export function offerText(standard: StandardClause[], edits: ClauseEdit[]): TextClause[] {
  const added = edits.filter((edit) => edit.clause === null);
  const known = new Set(standard.map((clause) => clause.id));
  const addedAfter = (id: number | null) =>
    added.flatMap((edit, index) =>
      (id === null ? edit.after === null || !known.has(edit.after) : edit.after === id)
        ? [{ key: `a${String(index + 1)}`, kind: edit.kind, title: edit.title, text: edit.text }]
        : [],
    );
  return [
    ...standard.flatMap((clause) => {
      const edit = edits.find((entry) => entry.clause === clause.id);
      const own: TextClause[] = edit?.removed
        ? []
        : [
            {
              key: `c${String(clause.id)}`,
              kind: clause.kind,
              title: edit?.title ?? clause.title,
              text: edit?.text ?? clause.text,
            },
          ];
      return [...own, ...addedAfter(clause.id)];
    }),
    ...addedAfter(null),
  ];
}
