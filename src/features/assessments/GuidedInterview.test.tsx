import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
});
async function open() {
  const user = userEvent.setup();
  renderApp('/dev/assessment-calculators');
  await user.selectOptions(
    await screen.findByLabelText('Previous sessions'),
    '11111111-1111-4111-8111-111111111111',
  );
  await screen.findByLabelText('Evidence group');
  const guide = within(screen.getByRole('region', { name: 'Guided interview' }));
  return { user, guide };
}
it('pins guidance, opens the suggested group and advances after an explicit unknown without inventing a value', async () => {
  const { user, guide } = await open();
  expect(guide.queryByText('Inspect the question-selection policy')).not.toBeInTheDocument();
  await user.click(await guide.findByRole('button', { name: 'Start or resume guided questions' }));
  await user.click(await guide.findByRole('button', { name: 'Answer the suggested question' }));
  expect(screen.getByLabelText('Evidence group')).toHaveValue('first_language');
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
  await user.click(guide.getByRole('button', { name: 'I do not know; defer this question' }));
  await guide.findByText(/1 answer\(s\) remain unresolved/);
  await user.click(guide.getByRole('button', { name: 'Answer the suggested question' }));
  expect(screen.getByLabelText('Evidence group')).toHaveValue('outside_quebec');
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
});
it('persists the user stop request and preserves snapshot access', async () => {
  const { user, guide } = await open();
  await user.click(await guide.findByRole('button', { name: 'Start or resume guided questions' }));
  await user.click(
    await guide.findByRole('button', { name: 'Pause questions for the current result' }),
  );
  await guide.findByText(/Questions are paused at your request/);
  expect(
    guide.queryByRole('button', { name: 'Answer the suggested question' }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record draft result' })).toBeEnabled(),
  );
});
it('keeps the same start request for an uncertain network retry', async () => {
  const requests: unknown[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/guidance/', async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.error();
    }),
  );
  const { user, guide } = await open();
  await user.click(await guide.findByRole('button', { name: 'Start or resume guided questions' }));
  await user.click(await guide.findByRole('button', { name: 'Retry the same interview request' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]).toEqual(requests[0]);
});
it('does not replace a dirty form with a suggested question', async () => {
  const { user, guide } = await open();
  await user.click(await guide.findByRole('button', { name: 'Start or resume guided questions' }));
  await guide.findByRole('button', { name: 'Answer the suggested question' });
  await waitFor(() => expect(screen.getByLabelText('Answer status')).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Answer status'), 'known');
  await user.type(screen.getByLabelText('Birth date'), '1996-11-12');
  expect(guide.getByRole('button', { name: 'Answer the suggested question' })).toBeDisabled();
  expect(guide.getByRole('button', { name: 'I do not know; defer this question' })).toBeDisabled();
});

it('refreshes both interview revision and guidance after an external revision conflict', async () => {
  let externalRevision = 0;
  const sent: number[] = [];
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/guidance/', () =>
      HttpResponse.json({
        revision: externalRevision,
        status: 'not_started',
        country: null,
        policy: { version: 'calculator-guidance-1', sha256: 'f'.repeat(64) },
        next_question: null,
      }),
    ),
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({
        revision: externalRevision,
        adapter_version: 'calculator-interview-1',
        answers: {},
        ruleset_sha256: 'a'.repeat(64),
        sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
      }),
    ),
    http.post('/api/applicant/v1/assessments/:id/calculators/guidance/', async ({ request }) => {
      const body = (await request.json()) as { revision: number };
      sent.push(body.revision);
      externalRevision = 2;
      return HttpResponse.json({ detail: 'Other tab changed the session' }, { status: 409 });
    }),
  );
  const { user, guide } = await open();
  await user.click(await guide.findByRole('button', { name: 'Start or resume guided questions' }));
  await guide.findByRole('button', { name: 'Retry the same interview request' });
  await user.click(guide.getByRole('button', { name: 'Refresh interview guidance' }));
  await waitFor(() =>
    expect(guide.getByRole('button', { name: 'Start or resume guided questions' })).toBeEnabled(),
  );
  await user.click(guide.getByRole('button', { name: 'Start or resume guided questions' }));
  await waitFor(() => expect(sent).toEqual([0, 2]));
});

it('opens the Australian route setup instead of a Canadian-only field', async () => {
  const { user, guide } = await open();
  await user.selectOptions(screen.getByLabelText('Country route'), 'australia');
  expect(screen.getByRole('button', { name: 'Record draft result' })).toBeDisabled();
  await user.click(await guide.findByRole('button', { name: 'Start or resume guided questions' }));
  await user.click(await guide.findByRole('button', { name: 'Answer the suggested question' }));
  expect(screen.getByLabelText('Evidence group')).toHaveValue('subclass');
  expect(screen.getByLabelText('Answer status')).toHaveValue('unknown');
  await user.click(guide.getByRole('button', { name: 'I do not know; defer this question' }));
  await guide.findByText(/No further question can currently resolve the gaps/);
  await user.click(guide.getByRole('button', { name: 'Pause questions for the current result' }));
  await guide.findByText(/Questions are paused. Choose an Australian subclass/);
  expect(screen.getByRole('button', { name: 'Record draft result' })).toBeDisabled();
});

it('shows policy effort and ranking to a permitted reviewer', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/calculators/options/', () =>
      HttpResponse.json({
        adapter_version: 'calculator-interview-1',
        can_review: true,
        schemas: { canada: { birth_date: { type: 'date' } }, australia: {} },
        identities: { canada: { birth_date: 'calculator:shared:birth_date' }, australia: {} },
        rulesets: [],
        sessions: [{ id: '11111111-1111-4111-8111-111111111111', revision: 0, completed: false }],
      }),
    ),
    http.get('/api/applicant/v1/assessments/:id/calculators/guidance/', () =>
      HttpResponse.json({
        revision: 0,
        status: 'not_started',
        country: null,
        policy: {
          version: 'calculator-guidance-1',
          sha256: 'f'.repeat(64),
          policy: { default_cost: 1, costs: { work: 5 } },
        },
        next_question: null,
        candidates: [],
      }),
    ),
  );
  const { user, guide } = await open();
  await user.click(await guide.findByText('Inspect the question-selection policy'));
  expect(guide.getByText('Default answer cost: 1')).toBeInTheDocument();
  expect(guide.getByText(/Costs are relative effort units/)).toBeInTheDocument();
});

it('keeps Australian points separate from an unmet entry condition', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({
        revision: 0,
        adapter_version: 'calculator-interview-1',
        answers: {
          'calculator:australia:subclass': {
            status: 'known',
            value: '189',
            source: 'user',
            document_verified: false,
            question_version: 'calculator-interview-1',
          },
        },
        ruleset_sha256: 'a'.repeat(64),
        sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
      }),
    ),
    http.post('/api/applicant/v1/assessments/:id/calculators/snapshots/', () =>
      HttpResponse.json(
        {
          id: 1,
          stale_reasons: [],
          reviews: [],
          payload: {
            country: 'australia',
            active: false,
            results: { score: 75, covered_requirements_status: 'unmet' },
            mapping: { unresolved: [] },
            context: { session_revision: 0 },
          },
        },
        { status: 201 },
      ),
    ),
  );
  const { user } = await open();
  await user.selectOptions(screen.getByLabelText('Country route'), 'australia');
  await user.click(screen.getByRole('button', { name: 'Record draft result' }));
  const results = await screen.findAllByRole('region', { name: 'Recorded result' });
  const first = results[0];
  if (!first) throw new Error('Recorded result missing');
  expect(within(first).getByText('Score at assessment date: 75')).toBeInTheDocument();
  expect(within(first).getByText('Covered requirements: Not met')).toBeInTheDocument();
});

it('requires explicit reconfirmation when the source changes but the applicant retains the old value', async () => {
  let writes = 0;
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({
        revision: 0,
        adapter_version: 'calculator-interview-1',
        answers: {
          'calculator:shared:birth_date': {
            status: 'known',
            value: '1996-11-12',
            source: 'profile_confirmed_by_user',
            document_verified: false,
          },
        },
        ruleset_sha256: 'a'.repeat(64),
        sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
      }),
    ),
    http.get('/api/applicant/v1/assessments/:id/calculators/guidance/', () =>
      HttpResponse.json({
        revision: 0,
        status: 'question',
        country: 'canada',
        policy: { version: 'calculator-guidance-1', sha256: 'f'.repeat(64) },
        next_question: {
          field: 'birth_date',
          reason: 'source_changed',
          tier: 0,
          effects: ['source_changed'],
          missing_paths: [],
          answer_cost: 1,
          shared_identity_count: 2,
          decision_sha256: 'e'.repeat(64),
        },
      }),
    ),
    http.post('/api/applicant/v1/assessments/:id/calculators/interview/', () => {
      writes++;
      return HttpResponse.json({
        revision: 1,
        answers: {
          'calculator:shared:birth_date': {
            status: 'known',
            value: '1996-11-12',
            source: 'user',
            document_verified: false,
          },
        },
      });
    }),
  );
  const { user, guide } = await open();
  await user.click(await guide.findByRole('button', { name: 'Answer the suggested question' }));
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(writes).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Save answer' }));
  await waitFor(() => expect(writes).toBe(1));
});

it('restores the guided country on session resume without starting a new round', async () => {
  let writes = 0;
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/guidance/', () =>
      HttpResponse.json({
        revision: 0,
        status: 'user_requested_result',
        country: 'australia',
        mode: 'scenario',
        policy: { version: 'calculator-guidance-1', sha256: 'f'.repeat(64) },
        next_question: null,
      }),
    ),
    http.post('/api/applicant/v1/assessments/:id/calculators/guidance/', () => {
      writes++;
      return HttpResponse.error();
    }),
  );
  await open();
  await waitFor(() => expect(screen.getByLabelText('Country route')).toHaveValue('australia'));
  expect(screen.getByLabelText('Purpose of the next interview round')).toHaveValue('scenario');
  expect(writes).toBe(0);
});
