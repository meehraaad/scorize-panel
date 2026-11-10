import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';

/**
 * A contract's text as the paper contract reads (backend-changes.md S69): articles ("ماده ۵:
 * حقوق و تعهدات مؤسسه", a title and an optional paragraph), their clauses without titles numbered
 * by the article and their place (۵-۱، ۵-۲…), and notes (تبصره ۱، ۲…, counted in each article).
 * Numbers come from the order, never from the server. A text written before S69 has no `kind`:
 * every clause of it is an article.
 */
export type ClauseKind = 'article' | 'clause' | 'note';

export interface TextClause {
  /** `c<id>` from the contract, `a<n>` added for a customer; texts before S69 have none. */
  key?: string;
  kind?: ClauseKind;
  title: string;
  text: string;
}

/** Where a clause sits: its article's number and its own (0 for the article itself). */
export interface ClauseNumber {
  kind: ClauseKind;
  article: number;
  n: number;
}

export const kindOf = (clause: { kind?: ClauseKind }): ClauseKind => clause.kind ?? 'article';

/** What tells a clause apart: its key, or, before S69, its title. */
export const keyOf = (clause: TextClause) => clause.key ?? clause.title;

export function numberClauses(clauses: { kind?: ClauseKind }[]): ClauseNumber[] {
  let article = 0;
  let clause = 0;
  let note = 0;
  return clauses.map((row) => {
    const kind = kindOf(row);
    if (kind === 'article') {
      article += 1;
      clause = 0;
      note = 0;
      return { kind, article, n: 0 };
    }
    if (kind === 'clause') {
      clause += 1;
      return { kind, article, n: clause };
    }
    note += 1;
    return { kind, article, n: note };
  });
}

/** `{{name}}` in a clause's text, as Django reads it (`variables.py`). */
const TOKEN = /\{\{\s*([^{}]{1,50}?)\s*\}\}/g;

export const token = (name: string) => `{{${name}}}`;

/** The names a text uses. */
export function namesIn(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((match) => (match[1] ?? '').trim()))];
}

export interface TextPart {
  text: string;
  /** A variable's value (or `[name]` when it has none). */
  variable?: string;
  missing?: boolean;
}

/** The text cut where its variables are, each filled from `values` (a blank shows as `[name]`). */
export function textParts(text: string, values: Record<string, string>): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const name = (match[1] ?? '').trim();
    const value = values[name];
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: value ? value : `[${name}]`, variable: name, missing: !value });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export const fillText = (text: string, values: Record<string, string>) =>
  textParts(text, values)
    .map((part) => part.text)
    .join('');

/** "ماده ۵"، "۵-۲"، "تبصره ۱": a clause's number as the contract prints it. */
export function useClauseLabel() {
  const { t } = useTranslation();
  const f = useFormat();
  return (number: ClauseNumber) =>
    number.kind === 'article'
      ? t('clauseNumber.article', { n: f.number(number.article) })
      : number.kind === 'note'
        ? t('clauseNumber.note', { n: f.number(number.n) })
        : number.article === 0
          ? f.number(number.n)
          : t('clauseNumber.clause', { article: f.number(number.article), n: f.number(number.n) });
}

/**
 * Names for a text's clauses, by key: "ماده ۲: تعهدات"، "۲-۱"، "تبصره ۱" as the contract prints
 * them. A removed clause (`change: 'removed'`) has no number: its title or the start of its text.
 */
export function useClauseNames(clauses: (TextClause & { change?: string | null })[]) {
  const label = useClauseLabel();
  const kept = clauses.filter((clause) => clause.change !== 'removed');
  const numbers = numberClauses(kept);
  const names = new Map<string, string>();
  kept.forEach((clause, index) => {
    const number = numbers[index];
    if (!number) return;
    names.set(
      keyOf(clause),
      number.kind === 'article' && clause.title
        ? `${label(number)}: ${clause.title}`
        : label(number),
    );
  });
  const start = (text: string) => text.split(/\s+/).slice(0, 6).join(' ');
  return (clause: TextClause | string) =>
    typeof clause === 'string'
      ? (names.get(clause) ?? clause)
      : (names.get(keyOf(clause)) ?? (clause.title || start(clause.text)));
}
