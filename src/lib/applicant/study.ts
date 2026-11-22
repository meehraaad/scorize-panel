import type { ChipTone } from '@/components/ui/Chip';

/**
 * Studying in a country as a way to stay there (a study `pathways.Pathway`), as the pathway finder's
 * study routes show it: a year's costs, how they fit the budget, the stay after graduating.
 */

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
