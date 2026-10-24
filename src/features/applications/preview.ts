import type { Application, ApplicationsData } from './api';

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const sample = (
  id: number,
  university: string,
  program: string,
  deadline: number,
  result: Application['result'],
  extra: Partial<Application> = {},
): Application => ({
  id,
  university,
  degree: 2,
  program,
  deadline: days(deadline),
  result,
  approval: 'approved',
  fee: { amount: 125, currency: 'CAD' },
  payment: 'paid',
  supervisor_note: null,
  showcase: null,
  ...extra,
});

/**
 * Sample applications for the locked preview (canvas V7 section 4): what a case looks like, never
 * anyone's real data. Shown faded and inert under the lock banner.
 */
export function previewApplications(): ApplicationsData {
  return {
    applies: { used: 6, total: 15 },
    results: [
      sample(1, 'University of Toronto', 'Computer Science', 18, 'completed', {
        payment: 'pending',
      }),
      sample(2, 'McGill University', 'Computer Science', 32, 'completed', {
        approval: 'pending',
        payment: 'pending',
      }),
      sample(3, 'TU Munich', 'Informatics', -21, 'accepted', { fee: null, payment: 'waived' }),
      sample(4, 'UBC', 'Data Science', 30, 'submitted'),
      sample(5, 'RWTH Aachen', 'Data Science', -10, 'waiting_for_recommendation', {
        fee: { amount: 75, currency: 'EUR' },
      }),
      sample(6, 'University of Edinburgh', 'Artificial Intelligence', -11, 'rejected', {
        fee: { amount: 90, currency: 'GBP' },
      }),
    ],
    visa: null,
  };
}
