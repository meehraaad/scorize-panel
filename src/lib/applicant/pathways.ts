import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StudyInfo } from '@/lib/applicant/estimate';

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
  /** A study route with a year's costs: the finder asks the budget for it. Absent on older servers. */
  has_costs?: boolean;
}

/** What the person can spend on the first year, in tomans (Django `pathways.study.FINDER_BUDGETS`). */
export const FINDER_BUDGETS = ['up_to_1b', '1b_2b', '2b_4b', '4b_8b', 'over_8b'] as const;
export type FinderBudget = (typeof FINDER_BUDGETS)[number];

/** A study route's year in costs and how it fits the budget. */
export type FinderStudy = Omit<StudyInfo, 'source_url' | 'checked_at'>;

export interface FinderOptions {
  pathways: FinderPathway[];
  factors: Factor[];
  /** Every country, for questions about destinations; empty or absent when no route asks one. */
  countries?: FinderPathway['country'][];
  /** Tomans per euro and per dollar now (null without a rate): an income typed in tomans is shown in euros. */
  rates?: { eur: number | null; usd: number | null };
  /** The study field groups (Persian names), for the field and occupation step. Absent on older servers. */
  field_groups?: FieldGroup[];
  /** What the profile already says: shown picked in the questions, every one editable. Absent on older servers. */
  prefill?: FinderPrefill;
  /**
   * Countries whose official occupation list Django checks the occupation against: their yes/no question
   * (`shortage_occupation`, `listed_occupation`) isn't asked once an occupation is picked.
   */
  occupation_lists?: { country_id: number; kind: 'shortage' | 'skilled' }[];
}

/** One of the study field groups (Django: the cleaned study field table). */
export interface FieldGroup {
  id: number;
  name: string;
}

/** A top study field found by a search, maybe through one of its sub-fields. */
export interface FieldMatch extends FieldGroup {
  /** The sub-field whose name matched; '' when the group's own name did. */
  matched: string;
}

/** An ISCO-08 occupation: its 4-digit code and its names. */
export interface Occupation {
  code: string;
  name: string;
  name_english?: string;
}

export interface FinderPrefill {
  field_group: number | null;
  occupation: { code: string; name: string } | null;
  work_years: number | null;
  /** From the work history, or what the person said before. */
  work_years_source: 'history' | 'reported' | '';
}

/** Net income a month, in tomans, euros or dollars: Django converts it to euros at the newest rates. */
export interface FinderIncome {
  amount: number;
  currency: 'toman' | 'eur' | 'usd';
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
  /** Money requirements met by less than 10%: a change in the exchange rate can undo them. Absent on older servers. */
  near?: string[];
  scores: { label: string; points: number; max_points: number }[];
  unanswered: string[];
  /** Best first; empty when it already passes or has no pass mark. Missing from older servers. */
  improvements?: PathwayImprovement[];
  /** A study route with costs: its first year and how it fits the budget; null or absent otherwise. */
  study?: FinderStudy | null;
  /** Answers Django worked out from the occupation (on the country's list or not). Absent on older servers. */
  derived?: PathwayDerived;
}

/** The yes/no factors the occupation answers by itself. */
export const OCCUPATION_FACTORS = [
  'shortage_occupation',
  'listed_occupation',
  'skilled_occupation',
] as const;
export type OccupationFactor = (typeof OCCUPATION_FACTORS)[number];
export type PathwayDerived = Partial<Record<OccupationFactor, boolean>>;

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

/** Occupations whose Persian or English name, or code, has this text (up to 20). */
export const occupationSearchQuery = (text: string) =>
  queryOptions({
    queryKey: ['applicant', 'pathways', 'occupations', text],
    queryFn: () =>
      api<{ occupations?: Occupation[] }>(
        `${PATHWAYS_API}/?occupation_search=${encodeURIComponent(text)}`,
      ),
    select: (data) => data.occupations ?? [],
    staleTime: 5 * 60_000,
  });

/**
 * Top study fields whose own name, or a sub-field's at any depth, has these words (up to 20): "نرم افزار" finds
 * its group. Absent on older servers: then only the groups' own names are searched, on the device.
 */
export const fieldSearchQuery = (text: string) =>
  queryOptions({
    queryKey: ['applicant', 'pathways', 'fields', text],
    queryFn: () =>
      api<{ field_matches?: FieldMatch[] }>(
        `${PATHWAYS_API}/?field_search=${encodeURIComponent(text)}`,
      ),
    select: (data) => data.field_matches ?? [],
    staleTime: 5 * 60_000,
  });

/**
 * What Django can already answer from this occupation, by the same code as `check/`: each country's list
 * questions, and whether it is skilled. null: it can't tell (a partial list match, a row not checked yet, ISCO
 * skill level 2), so the question is still asked. Absent on older servers: then nothing is skipped.
 */
export interface OccupationAnswers {
  occupation_answers?: Record<
    string,
    Partial<Record<'shortage_occupation' | 'listed_occupation', boolean | null>>
  >;
  skilled_occupation?: boolean | null;
}

export const occupationAnswersQuery = (code: string) =>
  queryOptions({
    queryKey: ['applicant', 'pathways', 'occupation', code],
    queryFn: () =>
      api<OccupationAnswers>(`${PATHWAYS_API}/?occupation=${encodeURIComponent(code)}`),
    staleTime: 5 * 60_000,
  });

/** Occupations people of this study field group usually have, shown first. */
export const suggestedOccupationsQuery = (fieldGroup: number) =>
  queryOptions({
    queryKey: ['applicant', 'pathways', 'suggested', fieldGroup],
    queryFn: () =>
      api<{ suggested_occupations?: Occupation[] }>(`${PATHWAYS_API}/?study_field=${fieldGroup}`),
    select: (data) => data.suggested_occupations ?? [],
    staleTime: 5 * 60_000,
  });

/** Answers about one destination (lived there, a job offer from it), by country id. */
export type CountryAnswers = Record<number, Answers>;

export const checkPathways = (
  answers: Answers,
  contact: FinderContact,
  byCountry: CountryAnswers = {},
  budget: FinderBudget | null = null,
  income: FinderIncome | null = null,
  /** The ISCO code picked, null for "don't know"; left out when the question wasn't asked (older servers). */
  occupation?: string | null,
) =>
  api<PathwayCheck>(`${PATHWAYS_API}/check/`, {
    method: 'POST',
    body: {
      answers,
      by_country: byCountry,
      budget,
      income,
      contact,
      ...(occupation === undefined ? {} : { occupation }),
    },
  });
