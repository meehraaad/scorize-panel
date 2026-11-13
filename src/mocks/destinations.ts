/** Backend-shaped fixtures for tests only; never imported by product code. */
import { http, HttpResponse } from 'msw';
import fixture from './destination-result.json';
import type {
  DestinationResult,
  DestinationSnapshot,
  IntakeInputs,
  PlanAction,
} from '@/features/assessments/destinationApi';
const ID = '22222222-2222-4222-8222-222222222222';
let result = structuredClone(fixture) as DestinationResult;
let snapshots: DestinationSnapshot[] = [];
let basisVersion = 0;
let progress: Record<string, { status: 'todo' | 'in_progress' | 'done'; basis: string }> = {};
function refreshPlan() {
  const plan = result.plan;
  if (!plan) return;
  const basis = String(basisVersion).padStart(64, '0');
  plan.routes = plan.selected_routes.map((id) => {
    const entry = result.entries.find((e) => e.id === id);
    if (!entry) return { id, available: false, actions: [], interview: null };
    const kinds = [
      'review_directory',
      entry.eligibility.reason === 'legal_date_out_of_coverage'
        ? 'refresh_legal_sources'
        : 'identify_program_requirements',
      'review_financial_basis',
      'independent_route_review',
    ];
    const actions: PlanAction[] = kinds.map((kind) => {
      const key = id + ':' + kind;
      const old = progress[key];
      const changed = Boolean(old && old.basis !== basis);
      return {
        id: key,
        kind,
        basis_sha256: basis,
        status: changed ? 'needs_recheck' : (old?.status ?? 'todo'),
        reported_status: old?.status ?? 'todo',
        basis_changed: changed,
        recorded_at: old ? '2026-11-13T01:00:00Z' : null,
        depends_on:
          kind === 'independent_route_review' ? kinds.slice(0, -1).map((k) => id + ':' + k) : [],
      };
    });
    return { id, title: entry.title, available: true, actions, interview: null };
  });
}
let requests = new Map<string, { signature: string; response: Record<string, unknown> }>();
export function resetDestinationMocks() {
  result = structuredClone(fixture) as DestinationResult;
  snapshots = [];
  basisVersion = 0;
  progress = {};
  requests = new Map();
}
const options = () => ({
  catalog: result.intake.active_catalog,
  today: '2026-11-13',
  active: false,
  countries: [
    { code: 'IR', name: 'Iran' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
  ],
  sessions: [{ id: ID, revision: result.context.session_revision, assessment_date: '2026-11-13' }],
});
export const destinationHandlers = [
  http.get('/api/applicant/v1/assessments/destinations/options/', () =>
    HttpResponse.json(options()),
  ),
  http.post('/api/applicant/v1/assessments/destinations/', async ({ request }) => {
    const body = (await request.json()) as { request_key: string };
    const old = requests.get(body.request_key);
    if (old)
      return old.signature === JSON.stringify(body)
        ? HttpResponse.json(old.response, { status: 201 })
        : HttpResponse.json({ detail: 'Key conflict' }, { status: 409 });
    const response = { id: ID, revision: 0, assessment_date: '2026-11-13', active: false };
    requests.set(body.request_key, { signature: JSON.stringify(body), response });
    return HttpResponse.json(response, { status: 201 });
  }),
  http.get('/api/applicant/v1/assessments/:id/destinations/', () => HttpResponse.json(result)),
  http.post('/api/applicant/v1/assessments/:id/destinations/', async ({ request }) => {
    const body = (await request.json()) as {
      request_key: string;
      revision: number;
      action: string;
      field?: keyof IntakeInputs;
      route_ids?: string[];
      action_id?: string;
      progress_status?: 'todo' | 'in_progress' | 'done';
      basis_sha256?: string;
      status: 'known' | 'unknown' | 'needs_confirmation' | 'not_applicable';
      value: string | string[] | null;
    };
    const previous = requests.get(body.request_key);
    if (previous)
      return previous.signature === JSON.stringify(body)
        ? HttpResponse.json(previous.response)
        : HttpResponse.json({ detail: 'Key conflict' }, { status: 409 });
    if (body.revision !== result.context.session_revision)
      return HttpResponse.json({ detail: 'Revision changed' }, { status: 409 });
    if (body.action === 'select_routes' && result.plan && body.route_ids) {
      const ids = body.route_ids;
      result.plan.selected_routes = ids;
      progress = Object.fromEntries(
        Object.entries(progress).filter(([key]) => ids.some((id) => key.startsWith(id + ':'))),
      );
    }
    if (
      body.action === 'action_progress' &&
      body.action_id &&
      body.progress_status &&
      body.basis_sha256
    )
      progress[body.action_id] = { status: body.progress_status, basis: body.basis_sha256 };
    if (body.field) basisVersion++;
    if (body.field)
      result.intake.inputs[body.field] = {
        status: body.status,
        value: body.value,
        source: 'user',
        document_verified: false,
      };
    result.context.session_revision++;
    const goals =
      result.intake.inputs.goals?.status === 'known' ? result.intake.inputs.goals.value : null;
    const destinations =
      result.intake.inputs.destinations?.status === 'known'
        ? result.intake.inputs.destinations.value
        : null;
    result.entries = result.entries.map((e) => ({
      ...e,
      relevance:
        Array.isArray(goals) && !goals.includes(e.goal)
          ? 'outside_stated_goals'
          : !Array.isArray(goals) || !Array.isArray(destinations)
            ? 'needs_preferences'
            : !destinations.length || destinations.includes(e.country)
              ? 'matches_preferences'
              : 'alternative_destination',
    }));
    refreshPlan();
    result.decision_sha256 = String(result.context.session_revision).padStart(64, '0');
    const response = {
      revision: result.context.session_revision,
      answers: {},
      destinations: structuredClone(result),
      active: false,
    };
    requests.set(body.request_key, { signature: JSON.stringify(body), response });
    return HttpResponse.json(response);
  }),
  http.post('/api/applicant/v1/assessments/:id/destinations/snapshots/', async ({ request }) => {
    const body = (await request.json()) as { request_key: string };
    const previous = requests.get(body.request_key);
    if (previous)
      return previous.signature === JSON.stringify(body)
        ? HttpResponse.json(previous.response, { status: 201 })
        : HttpResponse.json({ detail: 'Key conflict' }, { status: 409 });
    const row: DestinationSnapshot = {
      id: snapshots.length + 200,
      payload: structuredClone(result),
      reviews: [],
      stale_reasons: [],
    };
    snapshots = [row, ...snapshots];
    requests.set(body.request_key, { signature: JSON.stringify(body), response: { ...row } });
    return HttpResponse.json(row, { status: 201 });
  }),
  http.get(`/api/applicant/v1/assessments/${ID}/calculators/snapshots/`, () =>
    HttpResponse.json({ count: snapshots.length, page_size: 20, results: snapshots }),
  ),
  http.post(`/api/applicant/v1/assessments/${ID}/calculators/snapshots/:snapshot/replay/`, () =>
    HttpResponse.json({ matches: true, entries: result.entries, stale_reasons: [] }),
  ),
];
