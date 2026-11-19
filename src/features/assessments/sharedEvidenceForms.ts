import type { FormSchema } from './calculatorApi';
export type Kind = 'birth_date' | 'language' | 'employment';
const language: FormSchema = {
  type: 'object',
  properties: {
    test: {
      type: 'choice',
      choices: [
        'ielts_general_training',
        'ielts_academic',
        'celpip_general',
        'pte_core',
        'tcf_canada',
        'tef_canada',
      ],
    },
    scores: {
      type: 'object',
      properties: Object.fromEntries(
        ['reading', 'writing', 'listening', 'speaking'].map((s) => [s, { type: 'number' }]),
      ),
    },
    date: { type: 'date' },
    in_test_centre: { type: 'boolean' },
    one_skill_retake: { type: 'boolean' },
  },
};
const employment: FormSchema = {
  type: 'object',
  properties: {
    start: { type: 'date' },
    end: { type: 'date' },
    hours_per_week: { type: 'number' },
  },
};
export const sharedEvidenceSchemas: Record<Kind, FormSchema> = {
  birth_date: { type: 'date' },
  language,
  employment,
};
export function normalizeSharedEvidence(kind: Kind, value: unknown) {
  if (kind === 'birth_date') return value ?? null;
  const obj = (value ?? {}) as Record<string, unknown>;
  if (kind === 'employment')
    return {
      start: obj.start ?? null,
      end: obj.end ?? null,
      hours_per_week: obj.hours_per_week ?? null,
    };
  return {
    test: obj.test ?? null,
    scores: obj.scores ?? {},
    date: obj.date ?? null,
    in_test_centre: obj.in_test_centre ?? null,
    one_skill_retake: obj.one_skill_retake ?? null,
  };
}
