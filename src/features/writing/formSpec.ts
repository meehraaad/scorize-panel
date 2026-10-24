/**
 * Writing information forms (SOP, CV, …) are described as data: sections made of parts (a field,
 * a repeating list, a photo, read-only research interests). One page, one autosave and one final
 * submit serve every form. Field names are Django's, so answers travel as they are stored.
 *
 * Text lives in the `writing` dictionary under the form's type:
 *   <type>.section.<id>.title / .description, <type>.field.<name>, <type>.help.<name> (optional),
 *   <type>.option.<set>.<value>, <type>.item.<list>.<name>, <type>.add.<list>.
 * writing.test.ts checks every key a spec needs exists in every language.
 */

/** Writing orders with a form so far (Django SopResumeTicket types sop, cv, recommendation, pl). */
export const FORM_TYPES = ['sop', 'cv', 'recommendation', 'pl'] as const;
export type FormType = (typeof FORM_TYPES)[number];
export const isFormType = (value: unknown): value is FormType =>
  FORM_TYPES.includes(value as FormType);

export type FieldKind =
  | 'text'
  | 'textarea'
  /** Dropdown of `options`. */
  | 'select'
  /** Two or three options side by side (radio buttons). */
  | 'choice'
  | 'date'
  /** Year and month only ("2023-10"): CV periods. */
  | 'month'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  /** Several of `options` (checkboxes); the answer is a list of values. */
  | 'checks'
  /** Short labels the applicant types (research interests); the answer is a list. */
  | 'tags'
  /** A start term among the next intakes ("2027-fall"); see upcomingTerms(). */
  | 'term';

export interface FieldSpec {
  kind: FieldKind;
  name: string;
  required?: boolean;
  /** CharField max_length; textareas are TextFields (no limit). */
  maxLength?: number;
  /** Takes the whole row (textareas always do). */
  wide?: boolean;
  /** For select / choice: the dictionary set and its values, in order. */
  options?: { set: string; values: readonly (string | number | boolean)[] };
  /** Written in English (the CV): left-to-right input. */
  ltr?: boolean;
  /** choice: options one under another (long labels) instead of side by side. */
  layout?: 'stack';
  /** Asked only while another field of the same entry or form has this value. */
  when?: { name: string; value: Scalar };
}

export interface ListSpec {
  kind: 'list';
  name: string;
  /** At least one entry is needed for the final submit. */
  required?: boolean;
  fields: FieldSpec[];
  /** Field shown as each entry's title; then a subtitle line and an optional period. */
  title: string;
  subtitle?: string[];
  period?: [start: string, end: string];
  /** Field holding a web address, shown as a link on the entry (a professor's group page). */
  link?: string;
}

export interface PhotoSpec {
  kind: 'photo';
  name: string;
  required?: boolean;
}

/** The applicant's research interests, read-only here (edited on the documents page). */
export interface InterestsSpec {
  kind: 'interests';
  name: string;
}

export type Part = FieldSpec | ListSpec | PhotoSpec | InterestsSpec;

export interface SectionSpec {
  id: string;
  parts: Part[];
}

export interface FormSpec {
  type: FormType;
  sections: SectionSpec[];
  /** What the progress bar counts: answered questions (SOP) or finished sections (CV). */
  progress: 'questions' | 'sections';
  /**
   * The side column: `tips` lines (`<type>.tips.<n>`, titled `<type>.tipsTitle` when the form has
   * its own), the writer's phone card, a card that points to the writing ticket.
   */
  aside: { tips: number; ownTitle?: boolean; phone?: boolean; ticket?: boolean };
}

export type Scalar = string | number | boolean | null;
export type ListItem = Record<string, Scalar> & { id?: number };
export type AnswerValue = Scalar | ListItem[] | string[] | undefined;
export type Answers = Record<string, AnswerValue>;

export const isList = (part: Part): part is ListSpec => part.kind === 'list';
export const isField = (part: Part): part is FieldSpec =>
  part.kind !== 'list' && part.kind !== 'photo' && part.kind !== 'interests';
/** Answers that are lists of values (checkboxes, tags), not one value. */
export const isMulti = (field: FieldSpec) => field.kind === 'checks' || field.kind === 'tags';

/** Whether a field is asked, given the other answers of its entry (or form). */
export const applies = (field: FieldSpec, values: Record<string, AnswerValue>) =>
  !field.when || values[field.when.name] === field.when.value;

export function isAnswered(value: AnswerValue) {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

/** Required fields of a list entry that are still empty. */
export const itemGaps = (list: ListSpec, item: ListItem) =>
  list.fields
    .filter((field) => field.required && applies(field, item) && !isAnswered(item[field.name]))
    .map((f) => f.name);

/** Questions of a list entry it asks (see `when`), and how many of them are answered. */
export function itemStats(list: ListSpec, item: ListItem) {
  const asked = list.fields.filter((field) => applies(field, item));
  return {
    answered: asked.filter((field) => isAnswered(item[field.name])).length,
    total: asked.length,
  };
}

const items = (answers: Answers, list: ListSpec) => (answers[list.name] ?? []) as ListItem[];

/**
 * What blocks the final submit, in form order. A key is a field or photo name, a list name (no
 * entry yet) or "<list>.<index>" (an entry with required fields left).
 */
export function missingKeys(section: SectionSpec, answers: Answers): string[] {
  return section.parts.flatMap((part) => {
    if (part.kind === 'interests') return [];
    if (isList(part)) {
      const entries = items(answers, part);
      if (part.required && entries.length === 0) return [part.name];
      return entries.flatMap((item, index) =>
        itemGaps(part, item).length ? [`${part.name}.${String(index)}`] : [],
      );
    }
    if (isField(part) && !applies(part, answers)) return [];
    return part.required && !isAnswered(answers[part.name]) ? [part.name] : [];
  });
}

export function missingInForm(spec: FormSpec, answers: Answers) {
  return spec.sections.flatMap((section, index) =>
    missingKeys(section, answers).map((key) => ({ key, section: index })),
  );
}

/** How far a section is: parts answered, parts in it, required ones done, anything filled in. */
export function sectionStats(section: SectionSpec, answers: Answers) {
  const answered = section.parts.filter((part) => isAnswered(answers[part.name])).length;
  const complete = missingKeys(section, answers).length === 0;
  return {
    answered,
    total: section.parts.length,
    complete,
    /** Shown as done (✓): required parts answered and something filled in. */
    done: complete && answered > 0,
  };
}

export function formProgress(spec: FormSpec, answers: Answers) {
  if (spec.progress === 'sections') {
    const done = spec.sections.filter((section) => sectionStats(section, answers).done).length;
    return { done, total: spec.sections.length };
  }
  const stats = spec.sections.map((section) => sectionStats(section, answers));
  return {
    done: stats.reduce((sum, stat) => sum + stat.answered, 0),
    total: stats.reduce((sum, stat) => sum + stat.total, 0),
  };
}

/** The element to focus for a missing key (see the ids in FieldInput / ListField / PhotoField). */
export function elementIdFor(type: FormType, key: string, spec: FormSpec, answers: Answers) {
  const [name, index] = key.split('.');
  if (index === undefined) {
    const list = spec.sections.flatMap((s) => s.parts).find((p) => p.name === name);
    return list && isList(list) ? `${type}-${name}-add` : `${type}-${key}`;
  }
  const list = spec.sections.flatMap((s) => s.parts).find((p) => p.name === name);
  const item = list && isList(list) ? items(answers, list)[Number(index)] : undefined;
  const gap = list && isList(list) && item ? itemGaps(list, item)[0] : undefined;
  return `${type}-${String(name)}-${index}-${gap ?? ''}`;
}

export const TERM_SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;
export type TermSeason = (typeof TERM_SEASONS)[number];
/** Month each intake starts in (January, May, July, September). */
const TERM_MONTH: Record<TermSeason, number> = { winter: 0, spring: 4, summer: 6, fall: 8 };

/** The next `count` intakes after `now`, as "<year>-<season>" (start-term questions). */
export function upcomingTerms(now = new Date(), count = 6) {
  const terms: string[] = [];
  for (let year = now.getFullYear(); terms.length < count; year++)
    for (const season of TERM_SEASONS) {
      if (terms.length === count) break;
      if (new Date(year, TERM_MONTH[season], 1) > now) terms.push(`${String(year)}-${season}`);
    }
  return terms;
}

export function parseTerm(value: string) {
  const [year, season] = value.split('-');
  return TERM_SEASONS.includes(season as TermSeason) && Number(year)
    ? { year: Number(year), season: season as TermSeason }
    : null;
}
