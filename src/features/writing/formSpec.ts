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

export type FormType = 'sop' | 'cv';

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
  | 'number';

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
}

export type Scalar = string | number | boolean | null;
export type ListItem = Record<string, Scalar> & { id?: number };
export type AnswerValue = Scalar | ListItem[] | string[] | undefined;
export type Answers = Record<string, AnswerValue>;

export const isList = (part: Part): part is ListSpec => part.kind === 'list';
export const isField = (part: Part): part is FieldSpec =>
  part.kind !== 'list' && part.kind !== 'photo' && part.kind !== 'interests';

export function isAnswered(value: AnswerValue) {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

/** Required fields of a list entry that are still empty. */
export const itemGaps = (list: ListSpec, item: ListItem) =>
  list.fields.filter((field) => field.required && !isAnswered(item[field.name])).map((f) => f.name);

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
