import { http, HttpResponse } from 'msw';
import type {
  Band,
  CountryEstimate,
  EstimateAnswers,
  EstimateOptions,
  EstimatePrefill,
  EstimateResult,
} from '@/lib/applicant/estimate';
import { accountOf } from './account';
import { forbidden, notFound, storage } from './session';

/**
 * Django's admission-chance quiz (scorize-revolution `api/applicant/v1/estimate.py`), for the
 * tests: the same shapes, a toy estimate. A GPA of 17 or more (out of 20) is a high band, an
 * English certificate of 7 adds one, no certificate takes one away; percentages are off (null)
 * as on the server by default.
 */

const BASE = '/api/applicant/v1/estimate';

export const ESTIMATE_OPTIONS: Omit<EstimateOptions, 'prefill'> = {
  goals: ['study', 'work', 'both'],
  degrees: ['bachelor', 'master', 'phd'],
  field_groups: [
    { id: 1, name: 'Engineering', name_persian: 'مهندسی' },
    { id: 2, name: 'Medicine', name_persian: 'پزشکی' },
  ],
  countries: [
    { id: 10, name: 'آلمان' },
    { id: 11, name: 'ایتالیا' },
  ],
  budgets: ['under_500m', 'between_500m_1b', 'more_than_1b'],
  english_levels: ['none', 'under_6', '6_to_6_5', '7_plus'],
  english_exams: [
    { name: 'ielts', min: 1, max: 9 },
    { name: 'toefl', min: 0, max: 120 },
    { name: 'duolingo', min: 10, max: 160 },
  ],
  starts: ['soon', 'next_year', 'unsure'],
  contact_channels: ['call', 'whatsapp', 'none'],
  contact_times: ['now', 'evening', 'tomorrow'],
  referrals: ['telegram', 'instagram', 'google', 'friends', 'other'],
};

const BANDS: Band[] = ['low', 'medium', 'high'];
const IELTS_OF_LEVEL = { none: null, under_6: 5.5, '6_to_6_5': 6, '7_plus': 7 } as const;

/** What the tests read back: every answer sent, the users who opened the quiz. */
export const estimateAnswers: EstimateAnswers[] = [];
export const estimateStarts = new Set<number>();
const latest = new Map<number, EstimateResult>();
/** What each user's profile holds for the quiz: their last answers, as Django saves them. */
const profiles = new Map<number, Omit<EstimatePrefill, 'referral'>>();
const NOTHING: Omit<EstimatePrefill, 'referral'> = {
  degree: null,
  field_group: null,
  gpa: null,
  english: null,
  budget: null,
  countries: [],
};
let nextId = 1;

function gpaOn20(gpa: number) {
  if (gpa > 0 && gpa <= 4) return gpa * 5;
  if (gpa > 20 && gpa <= 100) return gpa / 5;
  return gpa;
}

function ieltsOf(english: EstimateAnswers['english']) {
  if ('level' in english) return IELTS_OF_LEVEL[english.level];
  if (english.exam === 'ielts') return english.score;
  return english.exam === 'toefl' ? (english.score >= 94 ? 7 : 6) : english.score >= 135 ? 7 : 6;
}

function estimateOf(answers: EstimateAnswers): EstimateResult {
  const gpa = gpaOn20(answers.gpa);
  const ielts = ieltsOf(answers.english);
  const base = gpa >= 17 ? 2 : gpa >= 14 ? 1 : 0;
  const english = ielts === null ? -1 : ielts >= 7 ? 1 : 0;
  const band = BANDS[Math.max(0, Math.min(2, base + english))] ?? 'low';
  const chosen = answers.countries.length
    ? ESTIMATE_OPTIONS.countries.filter((country) => answers.countries.includes(country.id))
    : ESTIMATE_OPTIONS.countries;
  const countries = chosen.map((country, index): CountryEstimate => ({
    country,
    band,
    chance: null,
    decided: index === 0 ? 42 : 0,
    factors: [
      { name: 'country', direction: 'none' },
      { name: 'degree', direction: 'none' },
      { name: 'gpa', direction: base === 2 ? 'up' : base === 0 ? 'down' : 'none' },
      { name: 'english', direction: english > 0 ? 'up' : english < 0 ? 'down' : 'none' },
      { name: 'field', direction: 'none' },
    ],
    similar:
      index === 0
        ? [{ university: 'University of Padova', field: 'مهندسی مکانیک', year: 2025 }]
        : [],
    improvements:
      english < 0 && band !== 'high'
        ? [{ english: 7, band_from: band, band_to: BANDS[BANDS.indexOf(band) + 1] ?? 'high' }]
        : [],
  }));
  return { id: nextId++, created_at: new Date().toISOString(), countries };
}

/** A quiz answered earlier by `user` (tests of the home after the quiz). */
export function addLatestEstimate(user: number) {
  latest.set(user, { id: nextId++, created_at: new Date().toISOString(), countries: [] });
}

const invalid = (field: string) =>
  HttpResponse.json({ [field]: ['This value is not valid.'] }, { status: 400 });

export const estimateHandlers = [
  http.get(`${BASE}/options/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    const options: EstimateOptions = {
      ...ESTIMATE_OPTIONS,
      // "How did you hear about us" is the account's answer, as on Django (`UserInfo.referred_from`).
      prefill: { ...(profiles.get(user) ?? NOTHING), referral: accountOf(user).data.referral },
    };
    return HttpResponse.json(options);
  }),

  http.post(`${BASE}/started/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    estimateStarts.add(user);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/`, async ({ request }) => {
    const user = storage.get();
    if (!user) return forbidden();
    const answers = (await request.json()) as EstimateAnswers;
    if (!ESTIMATE_OPTIONS.field_groups.some((group) => group.id === answers.field_group))
      return invalid('field_group');
    if (!(answers.gpa > 0 && answers.gpa <= 100)) return invalid('gpa');
    if (answers.referral && !ESTIMATE_OPTIONS.referrals.includes(answers.referral))
      return invalid('referral');
    estimateAnswers.push(answers);
    // Once: an earlier answer is kept.
    const account = accountOf(user).data;
    if (answers.referral && !account.referral) account.referral = answers.referral;
    profiles.set(user, {
      degree: answers.degree,
      field_group: answers.field_group,
      gpa: gpaOn20(answers.gpa),
      english: answers.english,
      budget: answers.budget,
      countries: answers.countries,
    });
    const result = estimateOf(answers);
    latest.set(user, result);
    return HttpResponse.json(result, { status: 201 });
  }),

  http.get(`${BASE}/latest/`, () => {
    const user = storage.get();
    if (!user) return forbidden();
    const result = latest.get(user);
    return result ? HttpResponse.json(result) : notFound();
  }),
];

export function resetEstimateMocks() {
  estimateAnswers.length = 0;
  estimateStarts.clear();
  latest.clear();
  profiles.clear();
  nextId = 1;
}
