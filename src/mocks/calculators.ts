/** Test-only contract fixtures. The application always uses the Django API. */
import { http, HttpResponse } from 'msw';
import schemas from './calculator-schemas.json';
import identities from './calculator-identities.json';
import type { Answer, Snapshot } from '@/features/assessments/calculatorApi';
const SESSION = '11111111-1111-4111-8111-111111111111';
let revision = 0;
let answers: Record<string, Answer> = {};
let snapshots: Snapshot[] = [];
let guideState = 'not_started';
let guideCountry = 'canada';
let guideMode = 'assessment';
export function resetCalculatorMocks() {
  revision = 0;
  answers = {};
  snapshots = [];
  guideState = 'not_started';
  guideCountry = 'canada';
  guideMode = 'assessment';
}
const interview = () => ({
  revision,
  adapter_version: 'calculator-interview-1',
  answers,
  ruleset_sha256: 'a'.repeat(64),
  sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
});
const guidance = () => {
  const first = answers['calculator:canada:first_language'];
  const route = answers['calculator:australia:subclass'];
  const routeDeferred = guideCountry === 'australia' && route?.status === 'unknown';
  const field =
    guideCountry === 'australia'
      ? route?.status !== 'known'
        ? 'subclass'
        : 'facts.birth_date'
      : !first
        ? 'first_language'
        : first.status === 'unknown'
          ? 'outside_quebec'
          : 'english_absent';
  const question = {
    field,
    reason: 'missing_evidence',
    tier: 2,
    effects: ['fsw.first_language_clb7'],
    missing_paths: [],
    answer_cost: 1,
    shared_identity_count: 1,
    decision_sha256: 'e'.repeat(64),
  };
  return {
    revision,
    status: guideState === 'question' && routeDeferred ? 'incomplete_needs_review' : guideState,
    country: guideState === 'not_started' ? null : guideCountry,
    mode: guideMode,
    policy: { version: 'calculator-guidance-1', sha256: 'f'.repeat(64) },
    next_question: guideState === 'question' && !routeDeferred ? question : null,
    deferred: routeDeferred ? ['subclass'] : first?.status === 'unknown' ? ['first_language'] : [],
    candidates: guideState === 'question' && !routeDeferred ? [question] : [],
  };
};
export const calculatorHandlers = [
  http.get('/api/applicant/v1/assessments/:id/calculators/guidance/', () =>
    HttpResponse.json(guidance()),
  ),
  http.post('/api/applicant/v1/assessments/:id/calculators/guidance/', async ({ request }) => {
    const body = (await request.json()) as {
      revision: number;
      action: string;
      country: string;
      mode: string;
    };
    if (body.revision !== revision)
      return HttpResponse.json({ detail: 'Stale revision' }, { status: 409 });
    guideState = body.action === 'start' ? 'question' : 'user_requested_result';
    guideCountry = body.country;
    guideMode = body.mode;
    revision += 1;
    return HttpResponse.json({ ...interview(), guidance: guidance() });
  }),
  http.get('/api/applicant/v1/assessments/:id/calculators/profile-evidence/', () =>
    HttpResponse.json({ revision, candidates: [], context: [] }),
  ),
  http.get('/api/applicant/v1/assessments/calculators/options/', () =>
    HttpResponse.json({
      adapter_version: 'calculator-interview-1',
      active: false,
      schemas,
      identities,
      rulesets: [{ id: 1, key: 'synthetic-test', version: 1 }],
      sessions: [{ id: SESSION, revision, completed: false }],
    }),
  ),
  http.post('/api/applicant/v1/assessments/', () =>
    HttpResponse.json({ id: SESSION }, { status: 201 }),
  ),
  http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
    HttpResponse.json(interview()),
  ),
  http.post('/api/applicant/v1/assessments/:id/calculators/interview/', async ({ request }) => {
    const body = (await request.json()) as {
      revision: number;
      country: string;
      field: string;
      value: unknown;
      status: Answer['status'];
    };
    if (body.revision !== revision)
      return HttpResponse.json({ detail: 'Stale revision' }, { status: 409 });
    answers[
      (body.country === 'canada' && body.field === 'birth_date') ||
      (body.country === 'australia' && body.field === 'facts.birth_date')
        ? 'calculator:shared:birth_date'
        : `calculator:${body.country}:${body.field}`
    ] = {
      status: body.status,
      value: body.value,
      source: 'user',
      question_version: 'calculator-interview-1',
      document_verified: false,
    };
    revision += 1;
    return HttpResponse.json(interview());
  }),
  http.get('/api/applicant/v1/assessments/:id/calculators/snapshots/', () =>
    HttpResponse.json({ count: snapshots.length, page_size: 20, results: snapshots }),
  ),
  http.post('/api/applicant/v1/assessments/:id/calculators/snapshots/', () => {
    const row: Snapshot = {
      id: snapshots.length + 1,
      stale_reasons: [],
      reviews: [],
      payload: {
        country: 'canada',
        active: false,
        context: { session_revision: revision },
        mapping: { unresolved: [] },
        results: {
          crs: {
            score: 424,
            score_status: 'complete_from_supplied_evidence',
            breakdown: {},
            nomination_scenario: {
              hypothetical: true,
              condition: 'confirmed_provincial_or_territorial_nomination',
              score: 1024,
              delta: 600,
            },
          },
          fsw: { score: 68 },
          express_entry: { status: 'met_covered_program' },
        },
      },
    };
    snapshots = [row, ...snapshots];
    return HttpResponse.json(row, { status: 201 });
  }),
];
