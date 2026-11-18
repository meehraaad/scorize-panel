import { useTranslation } from 'react-i18next';
import type { ContentName, EvaluatorResult, WorkflowQuestion } from './workflowApi';

/**
 * Names for evaluators and their parts. Specialist evaluators are named by the panel's
 * own translations; configured programs only by their reviewed content's labels, never
 * by another program's label that happens to share an id.
 */
export function useWorkflowNames() {
  const { t, i18n } = useTranslation('assessments');
  const labels = t('workflow.labels', { returnObjects: true }) as Record<string, string>;
  const checks = t('workflow.checks', { returnObjects: true }) as Record<string, string>;
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const locale = i18n.language === 'fa' ? 'fa' : 'en';
  /** Content's own name in the current language, else its default text. */
  const localized = (name: ContentName) => name[locale] ?? name.text;
  const content = (row?: EvaluatorResult) => {
    const own = row?.labels;
    return own && Object.keys(own).length > 0 ? own : null;
  };
  /** The evaluator's name; `withKind` adds "eligibility" or "score" for content-named ones. */
  const evaluator = (id: string, row?: EvaluatorResult, withKind = false) => {
    if (labels[id]) return labels[id];
    const title = content(row)?.title?.[locale];
    if (!title) return t('workflow.configured');
    if (!withKind || !row) return title;
    return t('workflow.namedEvaluator', {
      name: title,
      part: t(row.kind === 'score' ? 'workflow.score' : 'workflow.eligibility'),
    });
  };
  /** A condition check or score component of `row`. */
  const part = (row: EvaluatorResult, key: string) => {
    const generic = t(row.kind === 'score' ? 'workflow.scoreComponent' : 'workflow.condition');
    const own = content(row);
    if (own) {
      const name = (row.kind === 'score' ? own.components : own.checks)?.[key];
      return name ? localized(name) : generic;
    }
    return checks[key] ?? fields[key] ?? generic;
  };
  /** Whether a configured pass mark was reached, when the program declares one. */
  const passMark = (row: EvaluatorResult) =>
    row.score.pass_mark_met == null
      ? null
      : t(row.score.pass_mark_met ? 'workflow.passMarkMet' : 'workflow.passMarkNotMet');
  /** A question's title: configured content's translation, then its text, then the panel's own name. */
  const question = (q: Pick<WorkflowQuestion, 'label' | 'translations' | 'field'>) =>
    q.translations?.[locale] ??
    q.label ??
    fields[q.field.replaceAll('.', '_')] ??
    t('workflow.question');
  return { evaluator, part, passMark, question };
}
