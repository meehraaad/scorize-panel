import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import type { ChipTone } from '@/components/ui/Chip';
import { ACCOUNT_KEY, type Referral } from '@/lib/account/api';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * The admission-chance quiz of the new-user dashboard (any account, contract or not): the choices,
 * the answers in and a result per country out, and the last result on return. The answers also go
 * to the profile and, unless the person said not to be contacted, to a seller as a lead. Shapes:
 * docs/backend-changes.md H52–H54, H56. Until answered, the last step also asks "how did you hear about
 * us", the account page's question.
 */

export type Goal = 'study' | 'work' | 'both';
export type DegreeName = 'bachelor' | 'master' | 'phd';
export type EnglishLevel = 'none' | 'under_6' | '6_to_6_5' | '7_plus';
export type EnglishExam = 'ielts' | 'toefl' | 'duolingo';
export type Budget = 'under_500m' | 'between_500m_1b' | 'more_than_1b';
export type Start = 'soon' | 'next_year' | 'unsure';
export type ContactChannel = 'call' | 'whatsapp' | 'none';
export type ContactTime = 'now' | 'evening' | 'tomorrow';
export type Band = 'high' | 'medium' | 'low';
export type FactorName = 'country' | 'degree' | 'gpa' | 'english' | 'field';

/**
 * The answers the profile already holds (campaign and site forms, sellers' forms, an earlier quiz),
 * so a returning person confirms instead of typing again; null where it holds nothing usable.
 */
export interface EstimatePrefill {
  degree: DegreeName | null;
  field_group: number | null;
  /** Out of 20. */
  gpa: number | null;
  english: EstimateAnswers['english'] | null;
  budget: Budget | null;
  countries: number[];
  /** From the birth date, else the last quiz. */
  age: number | null;
  /** Years of work, when the profile has any. */
  work_years: number | null;
  /** "How did you hear about us", once answered (here or on the account page): asked only until then. */
  referral: Referral | null;
}

export interface EstimateOptions {
  prefill: EstimatePrefill;
  goals: Goal[];
  degrees: DegreeName[];
  /** Top-level study fields. */
  field_groups: { id: number; name: string; name_persian: string | null }[];
  /** Countries Scorize has decided outcomes for, by Persian name. */
  countries: { id: number; name: string }[];
  budgets: Budget[];
  english_levels: EnglishLevel[];
  english_exams: { name: EnglishExam; min: number; max: number }[];
  starts: Start[];
  contact_channels: ContactChannel[];
  contact_times: ContactTime[];
  referrals: Referral[];
}

export interface EstimateAnswers {
  goal: Goal;
  degree: DegreeName;
  field_group: number;
  /** Out of 20, 4 or 100: the server moves it to 20. */
  gpa: number;
  english: { level: EnglishLevel } | { exam: EnglishExam; score: number };
  budget: Budget;
  /** Empty: every country with outcomes for the degree. */
  countries: number[];
  start: Start;
  /** Optional (16–70): the work and migration routes need it. */
  age?: number;
  /** Optional (0–50): saved to the profile. */
  work_years?: number;
  contact: { channel: 'none' } | { channel: 'call' | 'whatsapp'; time: ContactTime };
  /** Optional; the server keeps an earlier answer. */
  referral?: Referral;
}

/** Work-only intent needs no academic facts and grants no contact permission by default. */
export interface WorkInquiry extends Pick<EstimateAnswers, 'contact' | 'referral'> {
  goal: 'work';
  gpa?: never;
}

/** How a band reads as a status pill. */
/** How long a country's bar is when the server sends a level, not a percentage. */
export const BAND_BAR: Record<Band, number> = { high: 85, medium: 55, low: 25 };

export const BAND_TONE: Record<Band, ChipTone> = { high: 'good', medium: 'warn', low: 'neutral' };

export type StudyCurrency = 'eur' | 'usd' | 'cad' | 'pound';
/** `tight`: only the cheaper universities fit the budget; `unknown`: no exchange rate. */
export type BudgetFit = 'fits' | 'tight' | 'over' | 'unknown';

/** ISO codes of the study costs' currencies, for Intl. */
export const CURRENCY_CODE: Record<StudyCurrency, string> = {
  eur: 'EUR',
  usd: 'USD',
  cad: 'CAD',
  pound: 'GBP',
};

export const FIT_TONE: Record<BudgetFit, ChipTone> = {
  fits: 'good',
  tight: 'warn',
  over: 'danger',
  unknown: 'neutral',
};

/**
 * Studying in the country as a way to stay there, as staff keep it (checked against `source_url`):
 * a year's costs, how they fit the budget, the stay after graduating and the route from there.
 */
export interface StudyInfo {
  currency: StudyCurrency;
  /** A year, cheaper to dearer universities. */
  tuition: { min: number; max: number };
  /** A year. */
  living: number;
  /** Tuition and living in tomans, rounded; null without an exchange rate. */
  first_year_toman: { min: number; max: number } | null;
  budget_fit: BudgetFit;
  post_study_visa: string;
  post_study_months: number | null;
  after_study: string;
  source_url: string;
  checked_at: string;
}

export interface CountryEstimate {
  country: { id: number; name: string };
  band: Band;
  /** 0–100, or null: show the band only (not enough outcomes, or percentages switched off). */
  chance: number | null;
  /** Decided applicants behind the estimate. */
  decided: number;
  factors: { name: FactorName; direction: 'up' | 'down' | 'none' }[];
  /** Up to 3 admissions of people with a similar background (no names). */
  similar: { university: string; field: string | null; year: number }[];
  /** A better English score that would raise the band. */
  improvements: { english: number; band_from: Band; band_to: Band }[];
  /** Null: no checked facts on studying there yet. */
  study: StudyInfo | null;
}

export interface EstimateResult {
  assessment_scope?: 'academic_admission' | 'work_not_supported';
  id: number;
  created_at: string;
  /** Best chance first. */
  countries: CountryEstimate[];
}

const BASE = '/applicant/v1/estimate';
const KEY = [...APPLICANT_KEY, 'estimate'] as const;

export const estimateOptionsQuery = queryOptions({
  queryKey: [...KEY, 'options'],
  queryFn: ({ signal }) => api<EstimateOptions>(`${BASE}/options/`, { signal }),
  staleTime: 10 * 60_000,
});

/** The last result, or null before the first quiz. */
export const latestEstimateQuery = queryOptions({
  queryKey: [...KEY, 'latest'],
  queryFn: async ({ signal }) => {
    try {
      return await api<EstimateResult>(`${BASE}/latest/`, { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});

/** Where the contact answer of this visit's quiz is kept, so every page shows the same promise. */
export const ANSWERED_CONTACT_KEY = [...KEY, 'answeredContact'] as const;

export function useSubmitEstimate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answers: EstimateAnswers | WorkInquiry) =>
      api<EstimateResult>(`${BASE}/`, { method: 'POST', body: answers }),
    onSuccess: (result, answers) => {
      client.setQueryData(latestEstimateQuery.queryKey, result);
      // Kept for the whole visit, not dropped after the cache's idle time like a fetched query.
      client.setQueryDefaults(ANSWERED_CONTACT_KEY, { gcTime: Infinity });
      client.setQueryData(ANSWERED_CONTACT_KEY, answers.contact);
      // The answers are now the profile's: the next quiz starts from them.
      void client.invalidateQueries({ queryKey: estimateOptionsQuery.queryKey });
      if (answers.referral) void client.invalidateQueries({ queryKey: ACCOUNT_KEY });
    },
  });
}

/** The quiz was opened (counted once a day on the server); failures don't matter to the user. */
export function markStarted() {
  return api(`${BASE}/started/`, { method: 'POST' }).catch(() => undefined);
}

/** Throttled: too many answers in an hour. */
export const isThrottled = (error: unknown) => error instanceof ApiError && error.status === 429;
