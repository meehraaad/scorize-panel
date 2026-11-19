import { http, HttpResponse } from 'msw';
import type { Answers, FinderPathway, PathwayResult } from '@/lib/applicant/pathways';
import type { PathwayDetail, PathwayInput, PathwayStatus } from '@/features/pathways/manageApi';
import { forbidden, notFound, storage } from './session';

/**
 * Fake pathways (scorize `api/applicant/v1/pathways.py`, `api/staff/v1/pathways.py`): two checked
 * routes (Germany's Opportunity Card, Canada's skilled worker) and one draft. Amir (6) is a
 * superuser, so he manages them; anyone logged in sees the checked ones in the finder.
 */

const SUPERUSER = 6;
const GERMANY = { id: 1, name: 'آلمان' };
const CANADA = { id: 2, name: 'کانادا' };
const AUSTRALIA = { id: 3, name: 'استرالیا' };
const COUNTRIES = [GERMANY, CANADA, AUSTRALIA];
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
] as const;

const now = () => new Date().toISOString();

function seed(): PathwayDetail[] {
  const base = {
    pass_mark: null,
    notes: '',
    needs_licensed_agent: false,
    review_by: null,
    is_active: true,
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
        { group: 3, factor: 'age', minimum: '18', maximum: '', value: '', label: 'حداقل ۱۸ سال' },
      ],
      criteria: [],
      factors: ['work_years', 'english_level', 'age'],
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
  ];
}

let pathways = seed();
export function resetPathwayMocks() {
  pathways = seed();
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
});

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
  const holds = (r: PathwayInput['requirements'][number]) => {
    const answer = answers[r.factor];
    if (answer === undefined) return false;
    if (typeof answer === 'number') return answer >= Number(r.minimum || -Infinity);
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
  };
}

const usable = () => pathways.filter((p) => p.status === 'published');
const status = (p: PathwayDetail): PathwayStatus =>
  !p.is_active ? 'off' : p.verified_at === null ? 'draft' : 'published';

export const pathwayHandlers = [
  http.get('/api/applicant/v1/pathways/', () => {
    if (!storage.get()) return forbidden();
    return HttpResponse.json({
      pathways: usable().map(finderPathway),
      factors: FACTORS,
    });
  }),
  http.post('/api/applicant/v1/pathways/check/', async ({ request }) => {
    if (!storage.get()) return forbidden();
    const body = (await request.json()) as { answers: Answers };
    const results = usable()
      .map((p) => evaluate(p, body.answers))
      .sort((a, b) => Number(b.qualifies) - Number(a.qualifies));
    return HttpResponse.json({ id: 1, created_at: now(), results }, { status: 201 });
  }),

  http.get('/api/staff/v1/pathways/', () => {
    if (storage.get() !== SUPERUSER) return forbidden();
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
    if (storage.get() !== SUPERUSER) return forbidden();
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
    if (storage.get() !== SUPERUSER) return forbidden();
    const row = pathways.find((p) => p.id === Number(params.id));
    return row ? HttpResponse.json(row) : notFound();
  }),
  ...(['post', 'put'] as const).map((method) =>
    http[method](
      method === 'post' ? '/api/staff/v1/pathways/' : '/api/staff/v1/pathways/:id/',
      async ({ request, params }) => {
        if (storage.get() !== SUPERUSER) return forbidden();
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
    if (storage.get() !== SUPERUSER) return forbidden();
    const row = pathways.find((p) => p.id === Number(params.id));
    if (!row) return notFound();
    Object.assign(row, { verified_at: now(), verified_by: 'امیر عابدی', updated_at: now() });
    row.status = status(row);
    return HttpResponse.json(row);
  }),
];
