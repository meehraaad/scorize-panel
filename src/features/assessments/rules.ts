import type { Condition, Question, Value } from './api';

export const valueOf = (question: Question): Value =>
  question.kind === 'boolean'
    ? false
    : question.kind === 'number'
      ? (question.minimum ?? 0)
      : (question.choices?.[0] ?? '');
export const conditionOf = (question: Question): Condition => ({
  fact: question.id,
  op: 'eq',
  value: valueOf(question),
});
