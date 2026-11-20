import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * The pathway finder (any account): the official routes to work or live in a country that staff
 * keep and have checked (Django `pathways.Pathway`, sales or marketing management > pathways), the questions they
 * need, and what each says for the person's answers. Django: `api/applicant/v1/pathways.py`.
 * The person never picks a route: they answer a few questions and we say which routes fit.
 */

export const PATHWAYS_API = '/applicant/v1/pathways';

export type FactorKind = 'number' | 'level' | 'choice' | 'yes_no';
export type PathwayGoal = 'work' | 'study' | 'any';
export type PathwayCost = 'low' | 'medium' | 'high' | '';

export interface Factor {
  name: string;
  kind: FactorKind;
  choices: string[];
}

export interface FinderPathway {
  id: number;
  /** `code`: ISO 3166 (DE) for its flag; empty or absent (older servers) when unknown. */
  country: { id: number; name: string; code?: string };
  /** Persian when staff gave one. */
  name: string;
  pass_mark: number | null;
  max_points: number;
  needs_licensed_agent: boolean;
  source_url: string;
  checked_at: string;
  /** The factors its rules test: the questions it needs. */
  factors: string[];
  goal: PathwayGoal;
  summary: string;
  tip: string;
  duration: string;
  cost: PathwayCost;
}

export interface FinderOptions {
  pathways: FinderPathway[];
  factors: Factor[];
}

export type FactorValue = number | string | boolean;
export type Answers = Record<string, FactorValue>;

/** What would bring a route not passed yet over the line ("IELTS 7: 10 more points"). */
export interface PathwayImprovement {
  /** The criterion's label (Persian). */
  label: string;
  factor: string;
  /** The value to reach: a number, a choice name, or `yes`. */
  target: string;
  /** The points it adds. */
  points: number;
  /** Enough alone to reach the pass mark. */
  passes: boolean;
}

export interface PathwayResult {
  pathway: FinderPathway;
  qualifies: boolean;
  eligible: boolean;
  points: number;
  /** The requirements not met (Persian). */
  missing: string[];
  scores: { label: string; points: number; max_points: number }[];
  unanswered: string[];
  /** Best first; empty when it already passes or has no pass mark. Missing from older servers. */
  improvements?: PathwayImprovement[];
}

export interface PathwayCheck {
  id: number;
  created_at: string;
  /** Qualifying first, then by how close. */
  results: PathwayResult[];
}

export type FinderContact = { channel: 'none' } | { channel: 'call'; time: 'now' };

export const finderOptionsQuery = queryOptions({
  queryKey: ['applicant', 'pathways'],
  queryFn: () => api<FinderOptions>(`${PATHWAYS_API}/`),
});

/** Answers about one destination (lived there, a job offer from it), by country id. */
export type CountryAnswers = Record<number, Answers>;

export const checkPathways = (
  answers: Answers,
  contact: FinderContact,
  byCountry: CountryAnswers = {},
) =>
  api<PathwayCheck>(`${PATHWAYS_API}/check/`, {
    method: 'POST',
    body: { answers, by_country: byCountry, contact },
  });
