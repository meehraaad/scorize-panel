import type { CustomerPathwayCheck } from '@/features/sales/api';
import { http, HttpResponse } from 'msw';
import {
  OCCUPATION_FACTORS,
  type Answers,
  type FinderBudget,
  type FinderOptions,
  type FinderPathway,
  type FinderPrefill,
  type FinderStudy,
  type Occupation,
  type PathwayDerived,
  type PathwayResult,
} from '@/lib/applicant/pathways';
import type { PathwayDetail, PathwayInput, PathwayStatus } from '@/features/pathways/manageApi';
import { forbidden, notFound, storage } from './session';

/**
 * Fake pathways (scorize `api/applicant/v1/pathways.py`, `api/staff/v1/pathways.py`): two checked
 * routes (Germany's Opportunity Card, Canada's skilled worker) and one draft. Amir (6) is a
 * superuser, so he manages them; anyone logged in sees the checked ones in the finder.
 */

const SUPERUSER = 6;
/** Who keeps the pathways: a superuser, the sales manager (Reza, 4) or the marketing manager. */
const MANAGERS: ReadonlySet<number | null> = new Set([SUPERUSER, 4]);
const manages = () => MANAGERS.has(storage.get());
const GERMANY = { id: 1, name: 'آلمان', code: 'DE' };
const CANADA = { id: 2, name: 'کانادا', code: 'CA' };
const AUSTRALIA = { id: 3, name: 'استرالیا', code: 'AU' };
const UK = { id: 4, name: 'انگلیس', code: 'GB' };
const COUNTRIES = [GERMANY, CANADA, AUSTRALIA, UK];
const FACTORS = [
  { name: 'age', kind: 'number', choices: [] },
  {
    name: 'education',
    kind: 'level',
    choices: ['none', 'secondary', 'vocational', 'bachelor', 'master', 'phd'],
  },
  { name: 'work_years', kind: 'number', choices: [] },
  { name: 'english_ielts', kind: 'number', choices: [] },
  { name: 'english_level', kind: 'level', choices: ['none', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  { name: 'german_level', kind: 'level', choices: ['none', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  { name: 'job_offer', kind: 'yes_no', choices: [] },
  { name: 'remote_work', kind: 'yes_no', choices: [] },
  { name: 'monthly_income_eur', kind: 'number', choices: [] },
  { name: 'remote_months', kind: 'number', choices: [] },
  { name: 'employer_years', kind: 'number', choices: [] },
  { name: 'children', kind: 'number', choices: [] },
] as const;

const now = () => new Date().toISOString();

function seed(): PathwayDetail[] {
  const base = {
    pass_mark: null,
    notes: '',
    needs_licensed_agent: false,
    review_by: null,
    is_active: true,
    currency: '' as const,
    tuition_min: null,
    tuition_max: null,
    living_per_year: null,
    post_study_visa: '',
    post_study_months: null,
    after_study: '',
    verified_by: 'امیر عابدی',
    updated_at: '2026-11-19T10:00:00Z',
  };
  return [
    {
      ...base,
      id: 1,
      country: GERMANY,
      name: 'Opportunity Card',
      name_persian: 'کارت فرصت',
      goal: 'work',
      kind: 'requirements',
      source_url: 'https://www.make-it-in-germany.com/en/',
      summary: 'ویزای یک‌ساله برای پیدا کردن کار در آلمان.',
      tip: 'آلمانی در حد A2 شانس را بیشتر می‌کند.',
      duration: '۴ تا ۸ ماه',
      cost: 'low',
      status: 'published',
      verified_at: '2026-11-19T10:00:00Z',
      requirements: [
        {
          group: 1,
          factor: 'education',
          minimum: 'vocational',
          maximum: '',
          value: '',
          label: 'مدرک کاردانی یا بالاتر',
        },
        {
          group: 2,
          factor: 'english_level',
          minimum: 'b2',
          maximum: '',
          value: '',
          label: 'انگلیسی B2',
        },
      ],
      criteria: [],
      factors: ['education', 'english_level'],
    },
    {
      ...base,
      id: 2,
      country: CANADA,
      name: 'Federal Skilled Worker',
      name_persian: 'کار ماهر فدرال',
      goal: 'work',
      kind: 'requirements',
      source_url: 'https://www.canada.ca/',
      summary: 'اقامت دائم برای کسانی که سابقه کار ماهر دارند.',
      tip: '',
      duration: '۱۲ تا ۱۸ ماه',
      cost: 'medium',
      status: 'published',
      verified_at: '2026-11-19T10:00:00Z',
      requirements: [
        {
          group: 1,
          factor: 'work_years',
          minimum: '1',
          maximum: '',
          value: '',
          label: 'حداقل ۱ سال سابقه کار',
        },
        {
          group: 2,
          factor: 'english_level',
          minimum: 'b2',
          maximum: '',
          value: '',
          label: 'انگلیسی B2',
        },
        {
          group: 1,
          factor: 'job_offer',
          minimum: '',
          maximum: '',
          value: 'yes',
          label: 'پیشنهاد کار از کانادا',
        },
        { group: 3, factor: 'age', minimum: '18', maximum: '', value: '', label: 'حداقل ۱۸ سال' },
      ],
      criteria: [],
      factors: ['work_years', 'job_offer', 'english_level', 'age'],
    },
    {
      ...base,
      id: 3,
      country: AUSTRALIA,
      name: 'Skilled Independent 189',
      name_persian: 'کار ماهر ۱۸۹',
      goal: 'work',
      kind: 'points',
      pass_mark: 65,
      source_url: 'https://immi.homeaffairs.gov.au/',
      summary: '',
      tip: '',
      duration: '',
      cost: '',
      status: 'draft',
      verified_at: null,
      verified_by: null,
      requirements: [],
      criteria: [
        {
          factor: 'age',
          label: 'سن',
          bands: [{ minimum: '25', maximum: '33', value: '', points: 30 }],
        },
      ],
      factors: ['age'],
    },
    {
      ...base,
      id: 4,
      country: UK,
      name: 'Student visa',
      name_persian: 'ویزای تحصیلی',
      goal: 'study',
      kind: 'requirements',
      source_url: 'https://www.gov.uk/student-visa',
      summary: 'پذیرش از دانشگاه انگلیس و بعد ویزای فارغ‌التحصیلی برای کار.',
      tip: '',
      duration: '۳ تا ۶ ماه',
      cost: 'high',
      currency: 'p',
      tuition_min: 15_000,
      tuition_max: 30_000,
      living_per_year: 10_539,
      post_study_visa: 'ویزای فارغ‌التحصیلی (Graduate)',
      post_study_months: 24,
      after_study: 'با پیشنهاد کار، ویزای کار ماهر و بعد اقامت دائم.',
      status: 'published',
      verified_at: '2026-11-19T10:00:00Z',
      requirements: [
        {
          group: 1,
          factor: 'education',
          minimum: 'secondary',
          maximum: '',
          value: '',
          label: 'حداقل دیپلم',
        },
        {
          group: 2,
          factor: 'english_level',
          minimum: 'b2',
          maximum: '',
          value: '',
          label: 'انگلیسی B2',
        },
      ],
      criteria: [],
      factors: ['education', 'english_level'],
    },
  ];
}

const NETHERLANDS = { id: 91, name: 'هلند', code: 'NL' };

/** Study field groups (Django: the cleaned study field table; 19 there, a few here). */
const FIELD_GROUPS = [
  { id: 1, name: 'مهندسی کامپیوتر و فناوری اطلاعات' },
  { id: 2, name: 'مهندسی عمران و معماری' },
  { id: 3, name: 'پزشکی، پرستاری و پیراپزشکی' },
  { id: 4, name: 'حقوق' },
  { id: 5, name: 'هنر و علوم انسانی' },
];
/** ISCO-08 occupations (Django `occupations.Occupation`). */
const OCCUPATIONS: Occupation[] = [
  { code: '2512', name: 'توسعه‌دهنده‌ی نرم‌افزار', name_english: 'Software developers' },
  { code: '2511', name: 'تحلیلگر سیستم', name_english: 'Systems analysts' },
  { code: '2142', name: 'مهندس عمران', name_english: 'Civil engineers' },
  { code: '2221', name: 'پرستار', name_english: 'Nursing professionals' },
  { code: '2611', name: 'وکیل', name_english: 'Lawyers' },
  { code: '5120', name: 'آشپز', name_english: 'Cooks' },
];
/** The occupations people of each field group usually have. */
const SUGGESTED: Record<number, string[]> = { 1: ['2512', '2511'], 2: ['2142'], 3: ['2221'] };
/**
 * Official occupation lists: Germany's shortage list, Australia's skilled list. `unknown`: codes Django can't
 * answer for (only some of the unit group is listed, or the row isn't checked yet): the question is asked.
 */
const OCCUPATION_LISTS = [
  {
    country_id: GERMANY.id,
    kind: 'shortage' as const,
    codes: ['2142', '2221'],
    unknown: ['2512'],
  },
  {
    country_id: AUSTRALIA.id,
    kind: 'skilled' as const,
    codes: ['2512', '2611', '2142'],
    unknown: ['2511'],
  },
];
const LIST_FACTOR = { shortage: 'shortage_occupation', skilled: 'listed_occupation' } as const;
/** ISCO skill levels 3 and 4 (major groups 1 to 3) are skilled, level 1 (group 9) isn't; level 2: unknown. */
const isSkilled = (code: string) =>
  ['1', '2', '3'].includes(code[0] ?? '') ? true : code[0] === '9' ? false : null;
/** Django's country factors: the only ones `by_country` takes. */
const COUNTRY_FACTORS = new Set([
  'recognition',
  'job_offer',
  'shortage_occupation',
  'listed_occupation',
  'skills_assessment',
  'stay_months',
]);

/** Django `GET pathways/?occupation=`: each list country's question, true, false or null (can't tell). */
function occupationAnswers(code: string) {
  return {
    occupation_answers: Object.fromEntries(
      OCCUPATION_LISTS.map((list) => [
        String(list.country_id),
        {
          [LIST_FACTOR[list.kind]]: list.unknown.includes(code) ? null : list.codes.includes(code),
        },
      ]),
    ),
    skilled_occupation: isSkilled(code),
  };
}

/**
 * Routes that ask about occupation lists or the field group, used instead of the usual ones by
 * `useOccupationRoutes` (the tests of the field and occupation step).
 */
function occupationSeed(kind: 'occupation' | 'field'): PathwayDetail[] {
  const [germany] = seed();
  if (!germany) return [];
  const route = (
    id: number,
    country: PathwayDetail['country'],
    name: string,
    factors: string[],
    requirements: PathwayDetail['requirements'],
  ): PathwayDetail => ({
    ...germany,
    id,
    country,
    name,
    name_persian: name,
    summary: '',
    tip: '',
    factors,
    requirements,
  });
  const yes = (group: number, factor: string, label: string) => ({
    group,
    factor,
    minimum: '',
    maximum: '',
    value: 'yes',
    label,
  });
  if (kind === 'field')
    return [
      route(
        20,
        GERMANY,
        'کار ماهر با مدرک',
        ['field_group', 'education'],
        [
          {
            group: 1,
            factor: 'education',
            minimum: 'bachelor',
            maximum: '',
            value: '',
            label: 'حداقل کارشناسی',
          },
        ],
      ),
    ];
  return [
    route(
      10,
      GERMANY,
      'ویزای کار ماهر',
      ['shortage_occupation'],
      [yes(1, 'shortage_occupation', 'شغل در فهرست کمبود آلمان')],
    ),
    route(
      11,
      AUSTRALIA,
      'کار ماهر ۱۹۰',
      ['listed_occupation'],
      [yes(1, 'listed_occupation', 'شغل در فهرست مشاغل ماهر استرالیا')],
    ),
    route(
      12,
      NETHERLANDS,
      'مهاجر بسیار ماهر',
      ['shortage_occupation'],
      [yes(1, 'shortage_occupation', 'شغل مورد نیاز هلند')],
    ),
    route(
      13,
      CANADA,
      'اکسپرس انتری',
      ['field_group', 'skilled_occupation'],
      [yes(1, 'skilled_occupation', 'شغل ماهر')],
    ),
  ];
}

let pathways = seed();
/** Tests: routes about occupations instead of the usual ones. */
let occupationRoutes: PathwayDetail[] | null = null;
/** Tests: a server from before the field and occupation step (none of its fields). */
let oldServer = false;
/** Tests: a server with the step but without `?occupation=` answers. */
let noOccupationAnswers = false;
const NO_PREFILL: FinderPrefill = {
  age: null,
  education: null,
  english_ielts: null,
  field_group: null,
  occupation: null,
  work_years: null,
  work_years_source: '',
};
let prefill = NO_PREFILL;
/** The last body the finder sent to `check/`. */
let lastCheck: object | null = null;
/** How many occupation searches came in, by text. */
let searches: string[] = [];

/** The sales customer page's `pathway_check`: a customer's latest quiz, by user id (Django's latest `PathwayCheck`). */
const customerChecks = new Map<number, CustomerPathwayCheck>();
export const customerPathwayCheck = (userId: number) => customerChecks.get(userId) ?? null;
export function setCustomerPathwayCheck(userId: number, check: CustomerPathwayCheck) {
  customerChecks.set(userId, check);
}

export function resetPathwayMocks() {
  customerChecks.clear();
  pathways = seed();
  occupationRoutes = null;
  oldServer = false;
  noOccupationAnswers = false;
  prefill = NO_PREFILL;
  lastCheck = null;
  searches = [];
}
export function withOccupationRoutes(kind: 'occupation' | 'field' = 'occupation') {
  occupationRoutes = occupationSeed(kind);
}
export function asOldPathwayServer() {
  oldServer = true;
}
export function withoutOccupationAnswers() {
  noOccupationAnswers = true;
}
export function setFinderPrefill(next: Partial<FinderPrefill>) {
  prefill = { ...NO_PREFILL, ...next };
}
export const lastPathwayCheck = () => lastCheck;
export const occupationSearches = () => searches;

/** Django: what the occupation says for each of the route's occupation factors. */
function derivedFor(p: PathwayDetail, occupation: string | null | undefined): PathwayDerived {
  if (!occupation) return {};
  const known = occupationAnswers(occupation);
  const derived: PathwayDerived = {};
  for (const factor of OCCUPATION_FACTORS) {
    if (!p.factors.includes(factor)) continue;
    const value =
      factor === 'skilled_occupation'
        ? known.skilled_occupation
        : known.occupation_answers[String(p.country.id)]?.[factor];
    // Can't tell: left to the person's own answer.
    if (typeof value === 'boolean') derived[factor] = value;
  }
  return derived;
}

const finderPathway = (p: PathwayDetail): FinderPathway => ({
  id: p.id,
  country: p.country,
  name: p.name_persian || p.name,
  pass_mark: p.pass_mark,
  max_points: 0,
  needs_licensed_agent: p.needs_licensed_agent,
  source_url: p.source_url,
  checked_at: p.verified_at ?? now(),
  factors: p.factors,
  goal: p.goal,
  summary: p.summary,
  tip: p.tip,
  duration: p.duration,
  cost: p.cost,
  has_costs: p.tuition_min !== null,
});

/** Tomans per unit (Django: the newest `finance.ExchangeRate`s through the US dollar). */
const TOMANS: Record<string, number> = { e: 110_000, u: 100_000, c: 72_000, p: 130_000 };
const CURRENCY: Record<string, FinderStudy['currency']> = {
  e: 'eur',
  u: 'usd',
  c: 'cad',
  p: 'pound',
};
/** The upper end of each budget (Django `pathways.study.FINDER_BUDGETS`). */
const BUDGET_MAX: Record<FinderBudget, number | null> = {
  up_to_1b: 1e9,
  '1b_2b': 2e9,
  '2b_4b': 4e9,
  '4b_8b': 8e9,
  over_8b: null,
};
const ROUND = 10_000_000;

/** Django's `pathways.study.study_info` with `range_fit`. */
function studyOf(p: PathwayDetail, budget: FinderBudget | null): FinderStudy | null {
  if (p.tuition_min === null || p.tuition_max === null || p.living_per_year === null) return null;
  const rate = TOMANS[p.currency] ?? 0;
  const low = (p.tuition_min + p.living_per_year) * rate;
  const high = (p.tuition_max + p.living_per_year) * rate;
  const max = budget ? BUDGET_MAX[budget] : undefined;
  return {
    currency: CURRENCY[p.currency] ?? 'usd',
    tuition: { min: p.tuition_min, max: p.tuition_max },
    living: p.living_per_year,
    first_year_toman: {
      min: Math.round(low / ROUND) * ROUND,
      max: Math.round(high / ROUND) * ROUND,
    },
    budget_fit:
      max === undefined
        ? 'unknown'
        : max === null || high <= max
          ? 'fits'
          : low <= max
            ? 'tight'
            : 'over',
    post_study_visa: p.post_study_visa,
    post_study_months: p.post_study_months,
    after_study: p.after_study,
  };
}

const LEVELS = ['none', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const EDUCATION = ['none', 'secondary', 'vocational', 'bachelor', 'master', 'phd'];
const ieltsLevel = (score: number) =>
  score >= 8.5 ? 'c2' : score >= 7 ? 'c1' : score >= 5.5 ? 'b2' : score >= 4 ? 'b1' : 'a2';

/** Django's `pathways.rules.evaluate`, for requirement-only routes. */
function evaluate(p: PathwayDetail, given: Answers): PathwayResult {
  const answers: Answers = { ...given };
  if (answers.english_level === undefined && typeof answers.english_ielts === 'number')
    answers.english_level = ieltsLevel(answers.english_ielts);
  const order = (factor: string, value: string) =>
    (factor === 'education' ? EDUCATION : LEVELS).indexOf(value);
  // Django: a minimum that rises with the family (`per_first`, `per_more`).
  const coming =
    (answers.partner && answers.partner !== 'single' ? 1 : 0) + Number(answers.children ?? 0);
  const minimumFor = (r: PathwayInput['requirements'][number]) =>
    Number(r.minimum || -Infinity) +
    (r.per_first ?? 0) * Math.min(coming, 1) +
    (r.per_more ?? 0) * Math.max(coming - 1, 0);
  const holds = (r: PathwayInput['requirements'][number]) => {
    const answer = answers[r.factor];
    if (answer === undefined) return false;
    if (typeof answer === 'number') return answer >= minimumFor(r);
    if (typeof answer === 'string') return order(r.factor, answer) >= order(r.factor, r.minimum);
    return answer === (r.value === 'yes');
  };
  const groups = new Map<number, PathwayInput['requirements']>();
  for (const r of p.requirements) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const missing = [...groups.values()]
    .filter((group) => !group.some(holds))
    .map((group) => group.map((r) => r.label).join(' / '));
  return {
    pathway: finderPathway(p),
    qualifies: missing.length === 0,
    eligible: missing.length === 0,
    points: 0,
    missing,
    scores: [],
    unanswered: p.factors.filter((factor) => answers[factor] === undefined),
    improvements: [],
    study: null,
  };
}

const usable = () => occupationRoutes ?? pathways.filter((p) => p.status === 'published');
const status = (p: PathwayDetail): PathwayStatus =>
  !p.is_active ? 'off' : p.verified_at === null ? 'draft' : 'published';

export const pathwayHandlers = [
  http.get('/api/applicant/v1/pathways/', ({ request }) => {
    if (!storage.get()) return forbidden();
    const params = new URL(request.url).searchParams;
    const text = params.get('occupation_search');
    if (text !== null && !oldServer) {
      searches = [...searches, text];
      const query = text.trim().toLowerCase();
      return HttpResponse.json({
        occupations: OCCUPATIONS.filter(
          (one) =>
            one.code.startsWith(query) ||
            one.name.includes(query) ||
            (one.name_english ?? '').toLowerCase().includes(query),
        ).slice(0, 20),
      });
    }
    const code = params.get('occupation');
    if (code !== null && !oldServer)
      return HttpResponse.json(noOccupationAnswers ? {} : occupationAnswers(code));
    const field = params.get('study_field');
    if (field !== null && !oldServer)
      return HttpResponse.json({
        suggested_occupations: (SUGGESTED[Number(field)] ?? []).flatMap((code) =>
          OCCUPATIONS.filter((one) => one.code === code),
        ),
      });
    const extra: Partial<FinderOptions> = oldServer
      ? {}
      : {
          field_groups: FIELD_GROUPS,
          prefill,
          occupation_lists: OCCUPATION_LISTS.map(({ country_id, kind }) => ({ country_id, kind })),
        };
    return HttpResponse.json({
      ...extra,
      pathways: usable().map(finderPathway),
      factors: FACTORS,
      rates: { eur: TOMANS.e, usd: TOMANS.u },
      // Django: every country, for questions about destinations.
      countries: [
        ...new Map(usable().map((p) => [p.country.id, finderPathway(p).country])).values(),
        { id: 90, name: 'اسپانیا', code: 'ES' },
        { id: 91, name: 'هلند', code: 'NL' },
      ],
    });
  }),
  http.post('/api/applicant/v1/pathways/check/', async ({ request }) => {
    if (!storage.get()) return forbidden();
    const body = (await request.json()) as {
      answers: Answers;
      by_country?: Record<string, Answers>;
      budget?: FinderBudget | null;
      income?: { amount: number; currency: 'toman' | 'eur' | 'usd' } | null;
      occupation?: string | null;
    };
    lastCheck = body;
    // Django: 400 for a factor that isn't about one country.
    const wrong = Object.values(body.by_country ?? {})
      .flatMap((answers) => Object.keys(answers))
      .filter((factor) => !COUNTRY_FACTORS.has(factor));
    if (wrong.length)
      return HttpResponse.json(
        { by_country: [`Not a question about one country: ${wrong.join(', ')}`] },
        { status: 400 },
      );
    // Django: the income becomes euros at the newest rates.
    const { income } = body;
    if (income && body.answers.monthly_income_eur === undefined) {
      const tomans = income.currency === 'toman' ? income.amount : income.amount * (TOMANS.u ?? 0);
      body.answers.monthly_income_eur =
        income.currency === 'eur' ? income.amount : Math.round(tomans / (TOMANS.e ?? 1));
    }
    // Answers about one country count for that country's routes only (Django: `by_country`).
    const results = usable()
      .map((p) => {
        // Django: the occupation answers the route's list questions itself.
        const derived = oldServer ? undefined : derivedFor(p, body.occupation);
        return {
          ...evaluate(p, {
            ...body.answers,
            ...body.by_country?.[String(p.country.id)],
            ...derived,
          }),
          study: studyOf(p, body.budget ?? null),
          ...(derived ? { derived } : {}),
        };
      })
      .sort((a, b) => Number(b.qualifies) - Number(a.qualifies));
    return HttpResponse.json({ id: 1, created_at: now(), results }, { status: 201 });
  }),

  http.get('/api/staff/v1/pathways/', () => {
    if (!manages()) return forbidden();
    return HttpResponse.json({
      pathways: pathways.map((p) => ({
        id: p.id,
        country: p.country,
        name: p.name,
        name_persian: p.name_persian,
        goal: p.goal,
        kind: p.kind,
        status: p.status,
        review_by: p.review_by,
        verified_at: p.verified_at,
      })),
      countries: COUNTRIES,
      factors: FACTORS,
    });
  }),
  http.post('/api/staff/v1/pathways/try/', async ({ request }) => {
    if (!manages()) return forbidden();
    const body = (await request.json()) as { pathway: PathwayInput; answers: Answers };
    const draft: PathwayDetail = {
      ...body.pathway,
      id: 0,
      country: COUNTRIES.find((c) => c.id === body.pathway.country) ?? GERMANY,
      status: 'draft',
      verified_at: null,
      verified_by: null,
      updated_at: now(),
      factors: body.pathway.requirements.map((r) => r.factor),
    };
    const result = evaluate(draft, body.answers);
    return HttpResponse.json({
      ...result,
      pass_mark: draft.pass_mark,
      max_points: 0,
      factors: draft.factors,
    });
  }),
  http.get('/api/staff/v1/pathways/:id/', ({ params }) => {
    if (!manages()) return forbidden();
    const row = pathways.find((p) => p.id === Number(params.id));
    return row ? HttpResponse.json(row) : notFound();
  }),
  ...(['post', 'put'] as const).map((method) =>
    http[method](
      method === 'post' ? '/api/staff/v1/pathways/' : '/api/staff/v1/pathways/:id/',
      async ({ request, params }) => {
        if (!manages()) return forbidden();
        const input = (await request.json()) as PathwayInput;
        if (!input.name)
          return HttpResponse.json({ name: ['This field is required.'] }, { status: 400 });
        const id =
          method === 'post' ? Math.max(...pathways.map((p) => p.id)) + 1 : Number(params.id);
        const row: PathwayDetail = {
          ...input,
          id,
          country: COUNTRIES.find((c) => c.id === input.country) ?? GERMANY,
          status: 'draft',
          verified_at: null,
          verified_by: null,
          updated_at: now(),
          factors: [
            ...new Set([
              ...input.requirements.map((r) => r.factor),
              ...input.criteria.map((c) => c.factor),
            ]),
          ],
        };
        row.status = status(row);
        pathways = [...pathways.filter((p) => p.id !== id), row];
        return HttpResponse.json(row, { status: method === 'post' ? 201 : 200 });
      },
    ),
  ),
  http.post('/api/staff/v1/pathways/:id/verify/', ({ params }) => {
    if (!manages()) return forbidden();
    const row = pathways.find((p) => p.id === Number(params.id));
    if (!row) return notFound();
    Object.assign(row, { verified_at: now(), verified_by: 'امیر عابدی', updated_at: now() });
    row.status = status(row);
    return HttpResponse.json(row);
  }),
];
