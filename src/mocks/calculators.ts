import financialFixture from './calculator-financial.json';
import type { FinancialDescription, FinancialInputs } from '@/features/assessments/financialTypes';
/** Test-only contract fixtures. The application always uses the Django API. */
import { http, HttpResponse } from 'msw';
import schemas from './calculator-schemas.json';
import identities from './calculator-identities.json';
import comparisonFixture from './calculator-comparison.json';
import type { Comparison, Answer, Snapshot } from '@/features/assessments/calculatorApi';
import type { Question } from '@/features/assessments/api';
const SESSION = '11111111-1111-4111-8111-111111111111';
let revision = 0;
let answers: Record<string, Answer> = {};
let snapshots: Snapshot[] = [];
let comparison = structuredClone(comparisonFixture) as Comparison;
let comparisonRequests = new Map<
  string,
  ReturnType<typeof interview> & { comparison: Comparison; active: boolean }
>();
let financial = structuredClone(financialFixture) as FinancialDescription;
let financialRequests = new Map<
  string,
  {
    request: string;
    response: ReturnType<typeof interview> & { financial: FinancialDescription; active: boolean };
  }
>();
let guideState = 'not_started';
let guideCountry = 'canada';
let guideMode = 'assessment';
type SharedFactMock = {
  id: string;
  revision: number;
  kind: string;
  status: string;
  value: unknown;
  confirmed_at: string | null;
  documents: {
    id: string;
    document_id: number;
    document_source: string;
    document_state: string;
    review_status: string;
    valid_from: string | null;
    valid_until: string | null;
  }[];
};
let sharedFacts: SharedFactMock[] = [];
export function resolveProgramEvidenceMock(
  binding: Question['shared_binding'],
  reference: { id: string; revision: number },
  selector: string,
  value: unknown,
) {
  const item = sharedFacts.find(
    (row) => row.id === reference.id && row.revision === reference.revision && row.confirmed_at,
  );
  const raw = item?.value as { test?: string; scores?: Record<string, unknown> } | undefined;
  if (
    !binding ||
    item?.kind !== binding.kind ||
    raw?.test !== binding.test ||
    selector !== binding.skill ||
    raw.scores?.[selector] !== value
  )
    return null;
  return {
    ...reference,
    kind: item.kind,
    binding,
    value: structuredClone(item.value),
    documents: structuredClone(item.documents),
  };
}
let sharedRequests = new Map<string, { request: string; response: string }>();
let interviewRequests = new Map<string, { request: string; response: string }>();
function invalidateShared(id: string) {
  let changed = false;
  for (const [key, answer] of Object.entries(answers)) {
    if (answer.status === 'known' && answer.shared_fact_refs?.some((ref) => ref.id === id)) {
      answers[key] = {
        ...answer,
        status: 'needs_confirmation',
        value: null,
        previous_answer: structuredClone(answer),
      };
      changed = true;
    }
  }
  if (changed) revision += 1;
}
export function resetCalculatorMocks() {
  revision = 0;
  financial = structuredClone(financialFixture) as FinancialDescription;
  financialRequests = new Map();
  comparison = structuredClone(comparisonFixture) as Comparison;
  comparisonRequests = new Map();
  answers = {};
  snapshots = [];
  guideState = 'not_started';
  guideCountry = 'canada';
  guideMode = 'assessment';
  sharedFacts = [];
  sharedRequests = new Map();
  interviewRequests = new Map();
}
const interview = () => ({
  revision,
  adapter_version: 'calculator-interview-1',
  assessment_date: '2026-11-12',
  engine_available: true,
  coverage_available: { canada: true, australia: true },
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
const comparisonView = () => ({
  ...comparison,
  context: { ...comparison.context, session_revision: revision },
  decision_sha256: String(revision).padStart(64, '0'),
});
export const calculatorHandlers = [
  http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () =>
    HttpResponse.json({ ...financial, revision }),
  ),
  http.post('/api/applicant/v1/assessments/:id/calculators/financial/', async ({ request }) => {
    const body = (await request.json()) as {
      revision: number;
      request_key: string;
      action: string;
      field?: keyof FinancialInputs;
      status: string;
      value: unknown;
    };
    const previous = financialRequests.get(body.request_key);
    if (previous)
      return previous.request === JSON.stringify(body)
        ? HttpResponse.json(previous.response)
        : HttpResponse.json({ detail: 'Key conflict' }, { status: 409 });
    if (body.revision !== revision)
      return HttpResponse.json({ detail: 'Revision changed' }, { status: 409 });
    if (body.field)
      financial.inputs = {
        ...financial.inputs,
        [body.field]: { status: body.status, value: body.value },
      };
    revision += 1;
    const response = { ...interview(), financial: { ...financial, revision }, active: false };
    financialRequests.set(body.request_key, { request: JSON.stringify(body), response });
    return HttpResponse.json(response);
  }),
  http.post('/api/applicant/v1/assessments/:id/calculators/financial/scenario/', () =>
    HttpResponse.json({
      hypothetical: true,
      writes: false,
      before: financial.routes['ca-fsw'],
      after: { ...financial.routes['ca-fsw'], status: 'insufficient' },
    }),
  ),
  http.get('/api/applicant/v1/assessments/:id/calculators/comparison/', () =>
    HttpResponse.json(comparisonView()),
  ),
  http.post('/api/applicant/v1/assessments/:id/calculators/comparison/', async ({ request }) => {
    const body = (await request.json()) as {
      revision: number;
      request_key: string;
      action: string;
      routes?: string[];
      task_id?: string;
      status?: 'todo' | 'in_progress' | 'done';
    };
    if (comparisonRequests.has(body.request_key))
      return HttpResponse.json(comparisonRequests.get(body.request_key));
    if (body.revision !== revision)
      return HttpResponse.json({ detail: 'Revision changed' }, { status: 409 });
    if (body.action === 'select_routes' && body.routes) {
      comparison.selected_routes = body.routes;
      comparison.routes = body.routes.flatMap((id) =>
        comparisonFixture.routes.filter((r) => r.route_id === id),
      ) as Comparison['routes'];
      comparison.actions = comparison.actions.filter((a) =>
        a.applies_to.some((id) => body.routes?.includes(id)),
      );
    } else {
      comparison.actions = comparison.actions.map((a) =>
        a.id === body.task_id
          ? { ...a, status: body.status ?? 'todo', requires_reassessment: body.status === 'done' }
          : a,
      );
    }
    revision += 1;
    const response = { ...interview(), comparison: comparisonView(), active: false };
    comparisonRequests.set(body.request_key, response);
    return HttpResponse.json(response);
  }),
  http.post('/api/applicant/v1/assessments/:id/calculators/comparison/snapshots/', () => {
    const row: Snapshot = {
      id: snapshots.length + 1,
      payload: comparisonView(),
      stale_reasons: [],
      reviews: [],
    };
    snapshots = [row, ...snapshots];
    return HttpResponse.json(row, { status: 201 });
  }),
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
  http.get('/api/applicant/v1/assessments/:id/calculators/document-links/', () =>
    HttpResponse.json({
      revision,
      documents: [],
      links: [],
      version: 'document-links-1',
      active: false,
      document_verified: false,
    }),
  ),
  http.get('/api/applicant/v1/assessments/:id/calculators/profile-evidence/', () =>
    HttpResponse.json({ revision, candidates: [], context: [] }),
  ),
  http.get('/api/applicant/v1/assessments/shared-evidence/', () =>
    HttpResponse.json({ version: 'shared-facts-1', evidence: sharedFacts, active: false }),
  ),
  http.post('/api/applicant/v1/assessments/shared-evidence/', async ({ request }) => {
    const body = (await request.json()) as {
      action: string;
      id?: string;
      revision: number;
      request_key: string;
      kind: string;
      status: string;
      value: unknown;
    };
    const prior = sharedRequests.get(body.request_key);
    if (prior)
      return prior.request === JSON.stringify(body)
        ? new HttpResponse(prior.response, { headers: { 'Content-Type': 'application/json' } })
        : HttpResponse.json({}, { status: 409 });
    let item = sharedFacts.find((row) => row.id === body.id);
    if (body.action === 'create') {
      item = {
        id: crypto.randomUUID(),
        revision: 1,
        kind: body.kind,
        status: body.status,
        value: body.value,
        confirmed_at: null,
        documents: [],
      };
      sharedFacts.push(item);
    } else if (!item || item.revision !== body.revision)
      return HttpResponse.json({}, { status: 409 });
    else {
      const unchanged =
        body.action === 'edit' &&
        item.status === body.status &&
        JSON.stringify(item.value) === JSON.stringify(body.value);
      const confirmed = body.action === 'confirm' && Boolean(item.confirmed_at);
      if (body.action === 'confirm' && item.status !== 'known')
        return HttpResponse.json({}, { status: 400 });
      item = {
        ...item,
        revision: item.revision + (unchanged || confirmed ? 0 : 1),
        ...(body.action === 'confirm'
          ? { confirmed_at: '2026-11-12T00:00:00Z' }
          : { status: body.status, value: body.value, confirmed_at: null }),
      };
      if (unchanged)
        item.confirmed_at = sharedFacts.find((row) => row.id === item?.id)?.confirmed_at ?? null;
      sharedFacts = sharedFacts.map((row) => (row.id === item?.id ? item : row));
      if (body.action === 'edit' && !unchanged) invalidateShared(item.id);
    }
    sharedRequests.set(body.request_key, {
      request: JSON.stringify(body),
      response: JSON.stringify(item),
    });
    return HttpResponse.json(item);
  }),
  http.post('/api/applicant/v1/assessments/shared-evidence/documents/', async ({ request }) => {
    const body = (await request.json()) as {
      id: string;
      revision: number;
      request_key: string;
      document_id: number;
      document_source: string;
      valid_from: string | null;
      valid_until: string | null;
    };
    const prior = sharedRequests.get(body.request_key);
    if (prior)
      return prior.request === JSON.stringify(body)
        ? new HttpResponse(prior.response, { headers: { 'Content-Type': 'application/json' } })
        : HttpResponse.json({}, { status: 409 });
    const item = sharedFacts.find((row) => row.id === body.id);
    if (!item || item.revision !== body.revision) return HttpResponse.json({}, { status: 409 });
    if (!item.confirmed_at || item.status !== 'known')
      return HttpResponse.json({}, { status: 409 });
    const link = {
      id: crypto.randomUUID(),
      document_id: body.document_id,
      document_source: body.document_source,
      document_state: 'current',
      review_status: 'unreviewed',
      valid_from: body.valid_from,
      valid_until: body.valid_until,
    };
    item.documents = [...item.documents.map((old) => ({ ...old, id: crypto.randomUUID() })), link];
    item.revision += 1;
    invalidateShared(item.id);
    const response = {
      ...link,
      evidence_id: item.id,
      evidence_revision: item.revision,
      document_verified: false,
    };
    sharedRequests.set(body.request_key, {
      request: JSON.stringify(body),
      response: JSON.stringify(response),
    });
    return HttpResponse.json(response);
  }),
  http.post(
    '/api/applicant/v1/assessments/shared-evidence/documents/remove/',
    async ({ request }) => {
      const body = (await request.json()) as {
        id: string;
        revision: number;
        link_id: string;
        request_key: string;
      };
      const prior = sharedRequests.get(body.request_key);
      if (prior)
        return prior.request === JSON.stringify(body)
          ? new HttpResponse(prior.response, { headers: { 'Content-Type': 'application/json' } })
          : HttpResponse.json({}, { status: 409 });
      const item = sharedFacts.find((row) => row.id === body.id);
      if (!item || item.revision !== body.revision) return HttpResponse.json({}, { status: 409 });
      if (!item.documents.some((link) => link.id === body.link_id))
        return HttpResponse.json({}, { status: 400 });
      item.documents = item.documents
        .filter((link) => link.id !== body.link_id)
        .map((link) => ({ ...link, id: crypto.randomUUID() }));
      item.revision += 1;
      invalidateShared(item.id);
      const response = structuredClone(item);
      sharedRequests.set(body.request_key, {
        request: JSON.stringify(body),
        response: JSON.stringify(response),
      });
      return HttpResponse.json(response);
    },
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
      request_key?: string;
      shared_references?: { id: string; revision: number }[];
      detach_shared?: boolean;
    };
    const requestKey = body.request_key;
    const previousRequest = requestKey && interviewRequests.get(requestKey);
    if (previousRequest)
      return previousRequest.request === JSON.stringify(body)
        ? new HttpResponse(previousRequest.response, {
            headers: { 'Content-Type': 'application/json' },
          })
        : HttpResponse.json({}, { status: 409 });
    if (body.revision !== revision)
      return HttpResponse.json({ detail: 'Stale revision' }, { status: 409 });
    const identity =
      (body.country === 'canada' && body.field === 'birth_date') ||
      (body.country === 'australia' && body.field === 'facts.birth_date')
        ? 'calculator:shared:birth_date'
        : `calculator:${body.country}:${body.field}`;
    const old = answers[identity];
    if (old?.shared_fact_refs && !body.shared_references && !body.detach_shared)
      return HttpResponse.json({}, { status: 400 });
    const refs = [];
    for (const ref of body.shared_references ?? []) {
      const item = sharedFacts.find(
        (row) =>
          row.id === ref.id &&
          row.revision === ref.revision &&
          row.confirmed_at &&
          row.status === 'known',
      );
      if (!item) return HttpResponse.json({}, { status: 409 });
      refs.push({
        ...ref,
        kind: item.kind,
        value: structuredClone(item.value),
        documents: structuredClone(item.documents),
      });
    }
    if (refs.length && (body.status !== 'known' || body.detach_shared))
      return HttpResponse.json({}, { status: 400 });
    if (refs.length) {
      if (new Set(refs.map((ref) => ref.id)).size !== refs.length)
        return HttpResponse.json({}, { status: 400 });
      const fieldKind =
        body.field === 'work'
          ? 'employment'
          : ['english', 'french'].includes(body.field)
            ? 'language'
            : ['birth_date', 'facts.birth_date'].includes(body.field)
              ? 'birth_date'
              : null;
      if (
        !fieldKind ||
        refs.some((ref) => ref.kind !== fieldKind) ||
        (fieldKind !== 'employment' && refs.length !== 1)
      )
        return HttpResponse.json({}, { status: 400 });
      if (fieldKind === 'birth_date' && body.value !== refs[0]?.value)
        return HttpResponse.json({}, { status: 400 });
      if (fieldKind === 'language') {
        const value = body.value as Record<string, unknown>;
        const raw = refs[0]?.value as Record<string, unknown>;
        if (
          value.test !== raw.test ||
          JSON.stringify(value.scores) !== JSON.stringify(raw.scores) ||
          value[body.country === 'canada' ? 'result_date' : 'test_date'] !== raw.date ||
          (body.country === 'australia' &&
            (value.in_test_centre !== raw.in_test_centre ||
              value.one_skill_retake !== raw.one_skill_retake))
        )
          return HttpResponse.json({}, { status: 400 });
      }
      if (fieldKind === 'employment') {
        const periods = body.value as Record<string, unknown>[];
        if (
          !Array.isArray(periods) ||
          periods.length !== refs.length ||
          refs.some((ref, index) =>
            ['start', 'end', 'hours_per_week'].some(
              (key) => periods[index]?.[key] !== (ref.value as Record<string, unknown>)[key],
            ),
          )
        )
          return HttpResponse.json({}, { status: 400 });
      }
    }
    answers[identity] = {
      status: body.status,
      value: body.value,
      source: refs.length ? 'shared_fact_confirmed_by_user' : 'user',
      question_version: 'calculator-interview-1',
      document_verified: false,
      ...(refs.length ? { shared_fact_refs: refs } : {}),
    };
    revision += 1;
    if (requestKey)
      interviewRequests.set(requestKey, {
        request: JSON.stringify(body),
        response: JSON.stringify(interview()),
      });
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
        context: { session_revision: revision, assessment_date: '2026-11-12' },
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
