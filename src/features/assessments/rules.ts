import type { Bundle, Condition, DraftInput, Expected, Question, Value } from './api';

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

export const references = (condition: Condition): string[] =>
  'fact' in condition
    ? [condition.fact]
    : ('all' in condition ? condition.all : condition.any).flatMap(references);

export function questionUsage(bundle: Bundle, id: string) {
  const affected = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of bundle.questions)
      if (!affected.has(q.id) && q.show_if && references(q.show_if).some((v) => affected.has(v))) {
        affected.add(q.id);
        changed = true;
      }
  }
  return bundle.routes.flatMap((route) => [
    ...route.requirements
      .filter((r) => references(r.condition).some((v) => affected.has(v)))
      .map((r) => ({ route: route.name, label: r.label, reason: 'eligibility' as const })),
    ...(route.scores ?? [])
      .filter((s) => s.bands.some((b) => references(b.condition).some((v) => affected.has(v))))
      .map((s) => ({ route: route.name, label: s.label, reason: 'score' as const })),
  ]);
}

export const questionReferenced = (bundle: Bundle, id: string) =>
  questionUsage(bundle, id).length > 0 ||
  bundle.questions.some((q) => q.show_if && references(q.show_if).includes(id));

export const nextId = (prefix: string, rows: { id: string }[]) => {
  let n = 1;
  while (rows.some((r) => r.id === `${prefix}-${String(n)}`)) n++;
  return `${prefix}-${String(n)}`;
};

export const blankExpected = (id: string, scored = false): Expected => ({
  route_id: id,
  eligibility_status: 'insufficient_information',
  score_status: scored ? 'partial' : 'not_applicable',
  score: null,
  pass_mark_met: null,
});

export function removeQuestion(input: DraftInput, id: string): DraftInput {
  if (input.bundle.questions.length <= 1 || questionReferenced(input.bundle, id)) return input;
  return {
    ...input,
    bundle: { ...input.bundle, questions: input.bundle.questions.filter((q) => q.id !== id) },
    scenarios: input.scenarios.map((s) => ({
      ...s,
      answers: Object.fromEntries(Object.entries(s.answers).filter(([key]) => key !== id)),
    })),
  };
}

export function removeRoute(input: DraftInput, id: string): DraftInput {
  if (input.bundle.routes.length <= 1) return input;
  return {
    ...input,
    bundle: { ...input.bundle, routes: input.bundle.routes.filter((r) => r.id !== id) },
    sources: input.sources.map((s) => ({ ...s, route_ids: s.route_ids.filter((v) => v !== id) })),
    scenarios: input.scenarios.map((s) => ({
      ...s,
      expected: s.expected.filter((r) => r.route_id !== id),
    })),
  };
}
