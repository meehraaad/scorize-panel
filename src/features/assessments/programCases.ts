import type { DestinationCase, DestinationPolicy } from './destinationApi';

/** Keep editable cases reachable after definition removal/type changes; expected results stay independent. */
export function retainProgramCases(policy: DestinationPolicy, test: DestinationCase) {
  return Object.fromEntries(
    policy.entries
      .filter((e) => e.enabled && e.program && test.programs?.[e.id])
      .map((entry) => {
        const questions = entry.program?.bundle.questions ?? [];
        const cases = (test.programs?.[entry.id] ?? []).map((value) => ({
          ...value,
          answers: Object.fromEntries(
            Object.entries(value.answers).filter(([id, fact]) => {
              const question = questions.find((q) => q.id === id);
              if (!question) return false;
              if (fact.status !== 'known') return true;
              return question.kind === 'boolean'
                ? typeof fact.value === 'boolean'
                : question.kind === 'number'
                  ? typeof fact.value === 'number'
                  : typeof fact.value === 'string' &&
                    Boolean(question.choices?.includes(fact.value));
            }),
          ),
        }));
        return [entry.id, cases];
      }),
  );
}
