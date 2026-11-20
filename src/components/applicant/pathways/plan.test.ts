import { describe, expect, it } from 'vitest';
import type { FinderPathway } from '@/lib/applicant/pathways';
import {
  ASKS,
  answeredPathways,
  countriesFor,
  countriesLeft,
  countryProgress,
  mergeByCountry,
  nextAsk,
} from './plan';

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

describe('questions about each country', () => {
  const stay = ASKS.find((ask) => ask.id === 'stay_months');
  it('asks once about every country whose routes need it', () => {
    const routes = [
      ...ROUTES,
      route(5, 'Ireland', ['stay_months']),
      route(6, 'Spain', ['stay_months']),
    ];
    expect(stay && countriesFor(routes, 'work', stay).map((c) => c.name)).toEqual([
      'Ireland',
      'Spain',
    ]);
  });
  it('keeps each country its own answers', () => {
    expect(
      mergeByCountry([
        { 1: { stay_months: 24 } },
        undefined,
        { 1: { job_offer: false }, 2: { job_offer: true } },
      ]),
    ).toEqual({ 1: { stay_months: 24, job_offer: false }, 2: { job_offer: true } });
  });
  it('counts what is left for each country', () => {
    const progress = countryProgress(ROUTES, 'work', new Set(['education']));
    expect(progress.find((c) => c.name === 'Germany')).toMatchObject({ total: 2, left: 1 });
  });
});

describe('the budget', () => {
  it('is asked last, and only for study routes with costs', () => {
    const study = { ...route(7, 'UK', ['education'], 'study'), has_costs: true };
    expect(nextAsk([study], 'study', new Set(['education']))?.id).toBe('budget');
    expect(nextAsk([study], 'study', new Set(['education', 'budget']))).toBeNull();
    expect(nextAsk(ROUTES, 'study', new Set(['education']))).toBeNull();
  });
  it('offers "not sure", which sends no budget', () => {
    const budget = ASKS.find((ask) => ask.id === 'budget');
    expect(budget?.options?.at(-1)).toEqual({ id: 'unsure', set: {} });
  });
});

describe('digital nomad questions', () => {
  it('asks remote work and income, and an income range counts as its lower end', () => {
    const nomad = route(8, 'Spain', [
      'education',
      'work_years',
      'remote_work',
      'monthly_income_eur',
    ]);
    const answered = new Set(['education', 'work_years']);
    expect(nextAsk([nomad], 'work', answered)?.id).toBe('remote_work');
    answered.add('remote_work');
    const income = nextAsk([nomad], 'work', answered);
    expect(income?.id).toBe('income');
    expect(income?.options?.find((o) => o.id === '2850_4000')?.set).toEqual({
      monthly_income_eur: 2850,
    });
  });
});
