import { toLatinNumber } from '@/lib/text';
import type { Referral } from '@/lib/account/api';
import type {
  Budget,
  ContactChannel,
  ContactTime,
  DegreeName,
  EnglishExam,
  EnglishLevel,
  EstimateAnswers,
  EstimatePrefill,
  Goal,
  Start,
} from '@/lib/applicant/estimate';

/** The quiz's answers while they're typed (the quiz and the applications tab's chance form). */

export type EnglishMode = EnglishLevel | 'score';
/** What the GPA is out of: typed as on the transcript, sent out of 20. */
export type GpaScale = '20' | '4' | '100';
export const GPA_SCALES: readonly GpaScale[] = ['20', '4', '100'];
export const GPA_EXAMPLE: Record<GpaScale, number> = { '20': 17.5, '4': 3.5, '100': 87.5 };

export interface Draft {
  goal: Goal;
  degree: DegreeName;
  field_group: string;
  gpa: string;
  gpaScale: GpaScale;
  english: EnglishMode;
  exam: EnglishExam;
  score: string;
  countries: number[];
  budget: Budget;
  start: Start;
  channel: ContactChannel;
  time: ContactTime;
  /** Optional: none picked sends none. */
  referral: Referral | null;
}

export const FIRST: Draft = {
  goal: 'study',
  degree: 'master',
  field_group: '',
  gpa: '',
  gpaScale: '20',
  english: 'none',
  exam: 'ielts',
  score: '',
  countries: [],
  budget: 'between_500m_1b',
  start: 'next_year',
  channel: 'call',
  time: 'now',
  referral: null,
};

/** The quiz's starting answers: what the profile already holds, the defaults for the rest. */
export function draftFrom(prefill: EstimatePrefill): Draft {
  const { english } = prefill;
  return {
    ...FIRST,
    degree: prefill.degree ?? FIRST.degree,
    field_group: prefill.field_group === null ? '' : String(prefill.field_group),
    gpa: prefill.gpa === null ? '' : String(prefill.gpa),
    english: english === null ? FIRST.english : 'level' in english ? english.level : 'score',
    exam: english && 'exam' in english ? english.exam : FIRST.exam,
    score: english && 'exam' in english ? String(english.score) : '',
    budget: prefill.budget ?? FIRST.budget,
    countries: prefill.countries,
  };
}

/** A number typed in Persian or Latin digits, or NaN. */
export const numberOf = (text: string) => (text.trim() ? Number(toLatinNumber(text.trim())) : NaN);

/**
 * The GPA out of 20, or NaN. The server reads 0–4 and 20–100 as other scales, so a GPA of 4 or less
 * out of 20 can't be sent: it counts as invalid.
 */
export function gpaOn20(draft: Draft) {
  const gpa = numberOf(draft.gpa);
  const scale = Number(draft.gpaScale);
  if (!(gpa > scale / 5 && gpa <= scale)) return NaN;
  return Math.round(gpa * (20 / scale) * 100) / 100;
}

/** The answers as Django takes them (`EstimateRequestSerializer`). */
export function answersOf(draft: Draft): EstimateAnswers {
  return {
    goal: draft.goal,
    degree: draft.degree,
    field_group: Number(draft.field_group),
    gpa: gpaOn20(draft),
    english:
      draft.english === 'score'
        ? { exam: draft.exam, score: numberOf(draft.score) }
        : { level: draft.english },
    budget: draft.budget,
    countries: draft.countries,
    start: draft.start,
    contact:
      draft.channel === 'none' ? { channel: 'none' } : { channel: draft.channel, time: draft.time },
    ...(draft.referral && { referral: draft.referral }),
  };
}
