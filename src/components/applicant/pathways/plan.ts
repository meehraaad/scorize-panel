import type { Answers, CountryAnswers, FactorValue, FinderPathway } from '@/lib/applicant/pathways';

/**
 * Which question to ask next: the fewest questions that answer one route fully come first, then
 * the ones that open the next route. So the person sees a first country after only a few
 * questions and can stop there, or go on for more countries.
 */

export type Goal = 'work' | 'study' | 'any';
/** A route's country: its id, name and flag code. */
export type Country = FinderPathway['country'];

/** An option of a question: the factors it fills (`english`: an IELTS band fills both). */
export interface AskOption {
  id: string;
  set: Answers;
}

export interface Ask {
  id: string;
  /** The Django factors (`pathways.rules.FACTORS`) it answers. */
  factors: readonly string[];
  /**
   * A number (`number`), one of the options, or `countries`: one question about every destination at once
   * ("which countries have you lived in, and for how long"), each country answered on its own.
   */
  input: 'number' | 'options' | 'countries';
  /** `countries`: what to ask of each country picked: years there, or how fully the degree is recognised. */
  detail?: 'years' | 'recognition';
  options?: readonly AskOption[];
  min?: number;
  max?: number;
  /** A number question's first value (the slider starts there). */
  start?: number;
}

const levels = (factor: string, names: readonly string[]): AskOption[] =>
  names.map((name) => ({ id: name, set: { [factor]: name } }));

/** In the order they are asked when several open the same route. */
export const ASKS: readonly Ask[] = [
  { id: 'age', factors: ['age'], input: 'number', min: 15, max: 80, start: 30 },
  {
    id: 'education',
    factors: ['education'],
    input: 'options',
    options: levels('education', ['secondary', 'vocational', 'bachelor', 'master', 'phd']),
  },
  {
    id: 'english',
    factors: ['english_ielts', 'english_level'],
    input: 'options',
    options: [
      { id: 'none', set: { english_level: 'a2' } },
      { id: 'ielts_4', set: { english_ielts: 4.5 } },
      { id: 'ielts_5_5', set: { english_ielts: 6 } },
      { id: 'ielts_7', set: { english_ielts: 7.5 } },
      { id: 'ielts_8_5', set: { english_ielts: 8.5 } },
    ],
  },
  { id: 'work_years', factors: ['work_years'], input: 'number', min: 0, max: 40, start: 3 },
  {
    id: 'german',
    factors: ['german_level'],
    input: 'options',
    options: levels('german_level', ['none', 'a1', 'a2', 'b1', 'b2', 'c1']),
  },
  { id: 'recognition', factors: ['recognition'], input: 'countries', detail: 'recognition' },
  { id: 'job_offer', factors: ['job_offer'], input: 'countries' },
  { id: 'shortage_occupation', factors: ['shortage_occupation'], input: 'countries' },
  { id: 'skills_assessment', factors: ['skills_assessment'], input: 'countries' },
  { id: 'stay_months', factors: ['stay_months'], input: 'countries', detail: 'years' },
  {
    id: 'partner',
    factors: ['partner'],
    input: 'options',
    options: levels('partner', ['single', 'skilled', 'english', 'other']),
  },
];

const ASK_OF = new Map(ASKS.flatMap((ask) => ask.factors.map((factor) => [factor, ask] as const)));

export const suits = (pathway: FinderPathway, goal: Goal) =>
  goal === 'any' || pathway.goal === 'any' || pathway.goal === goal;

/** The questions a route needs that aren't answered yet (factors we can't ask are skipped). */
export function remainingAsks(pathway: FinderPathway, answered: ReadonlySet<string>): Ask[] {
  const asks = new Set<Ask>();
  for (const factor of pathway.factors) {
    const ask = ASK_OF.get(factor);
    if (ask && !answered.has(ask.id)) asks.add(ask);
  }
  return ASKS.filter((ask) => asks.has(ask));
}

/** The next question: the first missing one of the route closest to fully answered; null when none. */
export function nextAsk(
  pathways: readonly FinderPathway[],
  goal: Goal,
  answered: ReadonlySet<string>,
): Ask | null {
  let best: Ask[] | null = null;
  for (const pathway of pathways) {
    if (!suits(pathway, goal)) continue;
    const left = remainingAsks(pathway, answered);
    if (left.length && (!best || left.length < best.length)) best = left;
  }
  return best?.[0] ?? null;
}

/** Routes for the goal with every question answered: ready to tell the person about. */
export const answeredPathways = (
  pathways: readonly FinderPathway[],
  goal: Goal,
  answered: ReadonlySet<string>,
) => pathways.filter((p) => suits(p, goal) && remainingAsks(p, answered).length === 0);

/** Countries not answered yet, each with the fewest questions left to one of its routes. */
export function countriesLeft(
  pathways: readonly FinderPathway[],
  goal: Goal,
  answered: ReadonlySet<string>,
): (Country & { left: number })[] {
  const byCountry = new Map<number, Country & { left: number }>();
  const done = new Set<number>();
  for (const pathway of pathways) {
    if (!suits(pathway, goal)) continue;
    const left = remainingAsks(pathway, answered).length;
    if (left === 0) done.add(pathway.country.id);
    const current = byCountry.get(pathway.country.id);
    if (!current || left < current.left)
      byCountry.set(pathway.country.id, { ...pathway.country, left });
  }
  return [...byCountry.values()]
    .filter((country) => !done.has(country.id))
    .sort((a, b) => a.left - b.left);
}

/** Every country for the goal, with its closest route's questions: how many in all, how many left. */
export function countryProgress(
  pathways: readonly FinderPathway[],
  goal: Goal,
  answered: ReadonlySet<string>,
): (Country & { total: number; left: number })[] {
  const none = new Set<string>();
  const byCountry = new Map<number, Country & { total: number; left: number }>();
  for (const pathway of pathways) {
    if (!suits(pathway, goal)) continue;
    const left = remainingAsks(pathway, answered).length;
    const total = remainingAsks(pathway, none).length;
    const current = byCountry.get(pathway.country.id);
    if (!current || left < current.left || (left === current.left && total < current.total))
      byCountry.set(pathway.country.id, { ...pathway.country, total, left });
  }
  return [...byCountry.values()];
}

/** How many questions are left for every route of the goal (each asked once). */
export function asksLeft(
  pathways: readonly FinderPathway[],
  goal: Goal,
  answered: ReadonlySet<string>,
): number {
  const left = new Set<string>();
  for (const pathway of pathways)
    if (suits(pathway, goal)) for (const ask of remainingAsks(pathway, answered)) left.add(ask.id);
  return left.size;
}

/** The countries a `countries` question is about: those of the goal's routes that need its factor. */
export function countriesFor(pathways: readonly FinderPathway[], goal: Goal, ask: Ask): Country[] {
  const found = new Map<number, Country>();
  for (const pathway of pathways)
    if (suits(pathway, goal) && ask.factors.some((factor) => pathway.factors.includes(factor)))
      found.set(pathway.country.id, pathway.country);
  return [...found.values()];
}

/** Answers about one country merged by country, as Django takes them (`by_country`). */
export const mergeByCountry = (parts: readonly (CountryAnswers | undefined)[]): CountryAnswers => {
  const merged: CountryAnswers = {};
  for (const part of parts)
    for (const [country, answers] of Object.entries(part ?? {}))
      merged[Number(country)] = { ...merged[Number(country)], ...answers };
  return merged;
};

/** The answers as Django takes them: every option's factors merged. */
export const mergeAnswers = (parts: Record<string, Answers>): Answers =>
  Object.assign({}, ...Object.values(parts)) as Record<string, FactorValue>;
