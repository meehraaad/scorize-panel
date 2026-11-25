import { api } from '@/lib/api/client';
import { PATHWAYS_API, type FinderGiven, type PathwayResult } from '@/lib/applicant/pathways';

/**
 * "What if my IELTS were 7?": the same evaluation as `check/` for changed answers. Django stores nothing and
 * makes no sales lead, so what sales sees stays what the person really answered.
 */
export const whatIfPathways = (given: FinderGiven) =>
  api<{ results: PathwayResult[] }>(`${PATHWAYS_API}/what-if/`, {
    method: 'POST',
    body: {
      answers: given.answers,
      by_country: given.byCountry,
      budget: given.budget,
      income: given.income,
      ...(given.occupation === undefined ? {} : { occupation: given.occupation }),
      ...(typeof given.gpa === 'number' ? { gpa: given.gpa } : {}),
    },
  });
