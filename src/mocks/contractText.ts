import type { ClauseEdit, StandardClause } from '@/features/sales/api';
import { fillText, type ClauseKind, type TextClause } from '@/lib/contractText';

type Change = 'changed' | 'added' | 'removed' | null;

/**
 * Django's `merged` (S69): the standard text with a customer's edits, each clause added after the
 * one it names (`after`; null or gone: at the end), keyed `c<id>` / `a<n>`, with what each changed.
 */
export function mergedText(
  standard: StandardClause[],
  edits: ClauseEdit[],
): (TextClause & { key: string; kind: ClauseKind; change: Change; base_text: string | null })[] {
  const added = edits.filter((edit) => edit.clause === null);
  const known = (id: number | null) => id !== null && standard.some((row) => row.id === id);
  const addedAfter = (id: number | null) =>
    added.flatMap((edit, index) =>
      (id === null ? !known(edit.after ?? null) : edit.after === id)
        ? [
            {
              key: `a${String(index + 1)}`,
              kind: edit.kind,
              title: edit.title,
              text: edit.text,
              change: 'added' as const,
              base_text: null,
            },
          ]
        : [],
    );
  const rows: ReturnType<typeof mergedText> = [];
  for (const clause of standard) {
    const edit = edits.find((entry) => entry.clause === clause.id);
    const kind = clause.kind;
    const key = `c${String(clause.id)}`;
    if (edit?.removed)
      rows.push({
        key,
        kind,
        title: clause.title,
        text: clause.text,
        change: 'removed',
        base_text: null,
      });
    else if (edit)
      rows.push({
        key,
        kind,
        title: edit.title,
        text: edit.text,
        change: 'changed',
        base_text: clause.text,
      });
    else
      rows.push({
        key,
        kind,
        title: clause.title,
        text: clause.text,
        change: null,
        base_text: null,
      });
    rows.push(...addedAfter(clause.id));
  }
  rows.push(...addedAfter(null));
  return rows;
}

/**
 * Django's `final_clauses`: the standard text with a customer's edits, each clause added after the
 * one it names (`after`; null: at the end), keyed, and its variables filled.
 */
export function finalText(
  standard: StandardClause[],
  edits: ClauseEdit[],
  values: Record<string, string>,
): TextClause[] {
  return mergedText(standard, edits)
    .filter((row) => row.change !== 'removed')
    .map(({ key, kind, title, text }) => ({ key, kind, title, text: fillText(text, values) }));
}

/** Django's `values_of`: the system's values for this customer, then the seller's. */
export function valuesOf(
  name: string,
  amount: number,
  variables: Record<string, string> = {},
): Record<string, string> {
  return {
    'نام مشتری': name,
    'مبلغ قرارداد': `${amount.toLocaleString('en-US')} تومان`,
    ...variables,
  };
}
