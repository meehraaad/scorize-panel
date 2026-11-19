import { describe, expect, it } from 'vitest';
import type { FinderPathway } from '@/lib/applicant/pathways';
import { answeredPathways, countriesLeft, nextAsk } from './plan';

const route = (
  id: number,
  country: string,
  factors: string[],
  goal: FinderPathway['goal'] = 'work',
) =>
  ({
    id,
    country: { id, name: country },
    name: country,
    factors,
    goal,
  }) as FinderPathway;

const ROUTES = [
  route(1, 'Canada', ['age', 'education', 'english_level', 'work_years']),
  route(2, 'Germany', ['education', 'english_level']),
  route(3, 'Australia', ['age', 'english_ielts', 'work_years', 'skills_assessment', 'partner']),
  route(4, 'Italy', ['education'], 'study'),
];

describe('the fewest questions to the first country', () => {
  it('asks what completes the closest route first, then opens the next', () => {
    const answered = new Set<string>();
    expect(nextAsk(ROUTES, 'work', answered)?.id).toBe('education');
    answered.add('education');
    expect(nextAsk(ROUTES, 'work', answered)?.id).toBe('english');
    answered.add('english');
    expect(answeredPathways(ROUTES, 'work', answered).map((p) => p.id)).toEqual([2]);
    expect(countriesLeft(ROUTES, 'work', answered)).toEqual([
      { id: 1, name: 'Canada', left: 2 },
      { id: 3, name: 'Australia', left: 4 },
    ]);
    expect(nextAsk(ROUTES, 'work', answered)?.id).toBe('age');
  });

  it('keeps to the goal, and stops when every route is answered', () => {
    expect(nextAsk(ROUTES, 'study', new Set())?.id).toBe('education');
    expect(nextAsk(ROUTES, 'study', new Set(['education']))).toBeNull();
  });
});
