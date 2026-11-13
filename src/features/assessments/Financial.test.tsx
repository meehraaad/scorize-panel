import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import fixture from '@/mocks/calculator-financial.json';
import { FinancialPolicyEditor } from './FinancialPolicyEditor';
import { FinancialResult } from './FinancialResult';
import type { FinancialPolicy, FinancialResult as Result } from './financialTypes';
import { render } from '@testing-library/react';
import { useState } from 'react';

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
  const area = within(screen.getByRole('region', { name: 'Financial fit' }));
  await user.click(area.getByRole('button', { name: 'Open financial questions' }));
  await area.findByText(/Assessment date 2026-11-12/);
  return { user, area };
}
it('loads financial questions explicitly, separates spending/proof, and preserves the point interview', async () => {
  let reads = 0;
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () => {
      reads++;
      return HttpResponse.json(fixture);
    }),
  );
  const user = userEvent.setup();
  renderApp('/dev/assessment-calculators');
  await user.selectOptions(
    await screen.findByLabelText('Previous sessions'),
    '11111111-1111-4111-8111-111111111111',
  );
  await screen.findByLabelText('Evidence group');
  expect(reads).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Open financial questions' }));
  expect(await screen.findByText(/Spending required: 100 Tomans/)).toBeInTheDocument();
  expect(screen.getByText(/separate from legal eligibility/)).toBeInTheDocument();
  expect(screen.getByLabelText('Evidence group')).toBeEnabled();
  expect(reads).toBe(1);
});
it('shows no exact-amount question for a range whose entire result is sufficient', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () =>
      HttpResponse.json({
        ...fixture,
        inputs: { ...fixture.inputs, budget: { status: 'known', value: { range_id: 'bounded' } } },
      }),
    ),
  );
  const { area } = await open();
  expect(area.queryByLabelText('Exact spending budget (Tomans)')).not.toBeInTheDocument();
});
it('asks exact amount when the backend reports a range-dependent result', async () => {
  const copy = structuredClone(fixture);
  copy.inputs.budget.value = { range_id: 'bounded' } as unknown as typeof copy.inputs.budget.value;
  copy.routes['ca-fsw'].ask_exact = true;
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () =>
      HttpResponse.json(copy),
    ),
  );
  const { user, area } = await open();
  const amount = area.getByLabelText('Exact spending budget (Tomans)');
  await user.type(amount, '125');
  expect(amount).toHaveValue(125);
  expect(screen.getByLabelText('Evidence group')).toBeDisabled();
  await user.click(area.getByRole('button', { name: 'Save Willingness to spend' }));
  await waitFor(() => expect(screen.getByLabelText('Evidence group')).toBeEnabled());
});
it('retains the exact UUID and body for an uncertain financial write retry', async () => {
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/financial/', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      requests.push(body);
      if (requests.length === 1)
        return HttpResponse.json({ detail: 'Interrupted' }, { status: 503 });
      return HttpResponse.json({
        revision: 1,
        answers: {},
        financial: {
          ...fixture,
          revision: 1,
          inputs: { ...fixture.inputs, budget: { status: 'known', value: { exact_toman: 200 } } },
        },
      });
    }),
  );
  const { user, area } = await open();
  const amount = area.getByLabelText('Exact spending budget (Tomans)');
  await user.clear(amount);
  await user.type(amount, '200');
  await user.click(area.getByRole('button', { name: 'Save Willingness to spend' }));
  await user.click(await area.findByRole('button', { name: 'Retry the same save request' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0]).toEqual(requests[1]);
  expect(amount).toHaveValue(200);
});
it('keeps unrelated unsaved financial fields when saving one answer', async () => {
  const { user, area } = await open();
  const budget = area.getByLabelText('Exact spending budget (Tomans)');
  await user.clear(budget);
  await user.type(budget, '200');
  const dependants = area.getByLabelText('Number of accompanying dependants');
  await user.clear(dependants);
  await user.type(dependants, '2');
  await user.click(area.getByRole('button', { name: 'Save Willingness to spend' }));
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Save Accompanying family' })).toBeEnabled(),
  );
  expect(dependants).toHaveValue(2);
  expect(screen.getByLabelText('Evidence group')).toBeDisabled();
});
it('preserves input through a tab conflict and refreshes both revisions before resubmission', async () => {
  let changed = false;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/financial/', () => {
      changed = true;
      return HttpResponse.json({ detail: 'Changed' }, { status: 409 });
    }),
    http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () =>
      HttpResponse.json({ ...fixture, revision: changed ? 4 : 0 }),
    ),
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () =>
      HttpResponse.json({
        adapter_version: 'calculator-interview-1',
        revision: changed ? 4 : 0,
        answers: {},
        sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
      }),
    ),
  );
  const { user, area } = await open();
  const amount = area.getByLabelText('Exact spending budget (Tomans)');
  await user.clear(amount);
  await user.type(amount, '200');
  await user.click(area.getByRole('button', { name: 'Save Willingness to spend' }));
  await area.findByText(/This assessment or financial policy changed/);
  expect(amount).toHaveValue(200);
  await user.click(
    area.getByRole('button', { name: 'Discard pending request and reload its status' }),
  );
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Save Willingness to spend' })).toBeEnabled(),
  );
  expect(amount).toHaveValue(200);
});
it('previews a hypothetical budget without saving it', async () => {
  let writes = 0;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/financial/', () => {
      writes++;
      return new HttpResponse(null, { status: 500 });
    }),
  );
  const { user, area } = await open();
  const amount = area.getByLabelText('Exact spending budget (Tomans)');
  await user.clear(amount);
  await user.type(amount, '1');
  await user.click(area.getByRole('button', { name: 'Preview hypothetical financial change' }));
  expect(await area.findByText(/Hypothetical comparison: no answer/)).toBeInTheDocument();
  expect(writes).toBe(0);
  expect(amount).toHaveValue(1);
});
it('keeps absent financial policy explicitly unknown', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () =>
      HttpResponse.json({
        ...fixture,
        policy: null,
        active_policy: null,
        routes: {
          'ca-fsw': {
            status: 'unknown',
            unknowns: ['policy_unavailable'],
            ask_exact: false,
            components: [],
          },
        },
      }),
    ),
  );
  const { area } = await open();
  expect(area.getByText(/No reviewed local financial policy/)).toBeInTheDocument();
  expect(
    area.queryByRole('button', { name: 'Confirm current financial policy' }),
  ).not.toBeInTheDocument();
});
it('edits stable ranges, open maxima, thresholds and draft reference data without JSON', async () => {
  function Harness() {
    const [p, set] = useState(fixture.policy.bundle as FinancialPolicy);
    return <FinancialPolicyEditor value={p} onChange={set} />;
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add budget range' }));
  expect(screen.getAllByLabelText('Stable identity')).toHaveLength(4);
  const maxima = screen.getAllByLabelText('Maximum (Tomans, inclusive; blank = open)');
  expect(maxima[2]).toHaveValue(null);
  await user.click(screen.getByRole('button', { name: 'Add rate' }));
  expect(screen.getByLabelText('Quoted unit')).toHaveValue('TOMAN');
  const rate = screen.getByLabelText('Quoted unit').closest('fieldset');
  if (!rate) throw new Error('Missing rate editor');
  expect(within(rate).getByLabelText('Reference review status')).toHaveValue('draft');
});
it('shows recorded source dates and safely renders untrusted source URLs in both languages', async () => {
  const result = structuredClone(fixture.routes['ca-fsw']) as Result;
  const first = result.components[0];
  if (!first) throw new Error('Missing fixture component');
  first.source_url = 'javascript:alert(1)';
  await i18n.changeLanguage('fa');
  render(<FinancialResult result={result} />);
  const user = userEvent.setup();
  await user.click(screen.getByText('اجزای هزینه، تمکن و اطلاعات منبع'));
  expect(screen.getByText('Synthetic test only').closest('a')).not.toHaveAttribute(
    'href',
    'javascript:alert(1)',
  );
  expect(screen.getByText(/نسخه fixture-1/)).toBeInTheDocument();
  expect(screen.getByText(/احتمال ویزا یا دعوت نیست/)).toBeInTheDocument();
});

it('saves a structured financial policy and reuses its UUID after an uncertain admin response', async () => {
  localStorage.setItem('scorize.mock.session', '4');
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/staff/v1/assessments/drafts/', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      requests.push(body);
      if (requests.length === 1)
        return HttpResponse.json({ detail: 'Interrupted' }, { status: 503 });
      return HttpResponse.json(
        {
          ...body,
          id: 99,
          revision: 1,
          state: 'draft',
          is_active: false,
          revoked: false,
          ruleset_id: null,
          last_run: null,
          events: [],
        },
        { status: 201 },
      );
    }),
  );
  const user = userEvent.setup();
  renderApp('/dev/assessments');
  await user.click(await screen.findByRole('button', { name: 'New draft' }));
  await user.type(screen.getByLabelText('Draft title'), 'Financial draft');
  await user.click(screen.getByRole('button', { name: 'Add financial policy' }));
  expect(screen.getByLabelText('Stable ruleset key (Latin)')).toHaveValue('assessment-finance');
  const submit = screen.getByRole('button', { name: 'Save draft' });
  await user.click(submit);
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Draft title')).toHaveValue('Financial draft');
  await user.click(submit);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0]).toMatchObject({
    key: 'assessment-finance',
    bundle: { financial_policy: { ranges: fixture.policy.bundle.ranges } },
    scenarios: [
      { financial: [{ route_id: 'ca-fsw', expected: { status: 'unknown', ask_exact: false } }] },
    ],
  });
});

it('records proof family size separately without altering accompanying dependants', async () => {
  const { user, area } = await open();
  await user.selectOptions(
    area.getByLabelText(
      'Family size required for proof (including applicant and any non-accompanying members required by the rule)',
    ),
    'known',
  );
  await user.type(area.getByLabelText('Number of family members for this proof requirement'), '3');
  expect(area.getByLabelText('Number of accompanying dependants')).toHaveValue(0);
  await user.click(
    area.getByRole('button', {
      name: 'Save Proof family size',
    }),
  );
  await waitFor(() => expect(screen.getByLabelText('Evidence group')).toBeEnabled());
  expect(area.getByLabelText('Number of family members for this proof requirement')).toHaveValue(3);
  expect(area.getByLabelText('Number of accompanying dependants')).toHaveValue(0);
});

it('records after JSONB reorders financial facts and server provenance', async () => {
  let revision = 0;
  const inputs = structuredClone(fixture.inputs) as Record<string, unknown>;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/financial/', async ({ request }) => {
      const body = (await request.json()) as { field: string; status: string; value: unknown };
      revision++;
      inputs[body.field] = {
        value: body.value,
        status: body.status,
        source: 'user',
        document_verified: false,
      };
      return HttpResponse.json({
        revision,
        answers: {},
        financial: {
          ...fixture,
          revision,
          inputs: Object.fromEntries(Object.entries(inputs).reverse()),
        },
      });
    }),
  );
  const { user, area } = await open();
  const amount = area.getByLabelText('Exact spending budget (Tomans)');
  await user.clear(amount);
  await user.type(amount, '200');
  await user.click(area.getByRole('button', { name: 'Save Willingness to spend' }));
  await waitFor(() => expect(screen.getByLabelText('Evidence group')).toBeEnabled());
  expect(area.getByRole('button', { name: 'Save Willingness to spend' })).toBeDisabled();
});
