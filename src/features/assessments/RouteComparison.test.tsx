import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import fixture from '@/mocks/calculator-comparison.json';
import type { Comparison } from './calculatorApi';

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
  const area = within(screen.getByRole('region', { name: 'Compare routes and next actions' }));
  await user.click(area.getByRole('button', { name: 'Open route comparison and action plan' }));
  await area.findByText('Canada — Federal Skilled Worker', { selector: 'h3' });
  return { user, area };
}
it('shows different score systems, unsupported routes, conditions and honest unavailable evidence', async () => {
  const { area } = await open();
  expect(area.getAllByText('CRS score: 424', { exact: false })).toHaveLength(2);
  expect(area.getByText('Australian points: 75', { exact: false })).toBeInTheDocument();
  expect(
    area.getByText('Unsupported; specialist review needed', { exact: false }),
  ).toBeInTheDocument();
  expect(
    area.getAllByText('Evidence for this specific subclass required', { exact: false }),
  ).toHaveLength(2);
  expect(area.getByText(/not ranked together/)).toBeInTheDocument();
  expect(
    area.getAllByText(/financial fit and success probability remain undetermined/),
  ).toHaveLength(6);
  expect(area.getByRole('button', { name: 'Record comparison and action plan' })).toBeEnabled();
});
it('persists reported action completion without changing the unmet condition', async () => {
  const { user, area } = await open();
  const progress = area.getAllByLabelText(/Progress: Review unmet condition/)[0];
  expect(progress).toBeDefined();
  if (!progress) return;
  await user.selectOptions(progress, 'done');
  await area.findByText(/You reported completion; this gap remains/);
  expect(
    area.getByText('Canada — Canadian Experience Class', { selector: 'h3' }).closest('article'),
  ).toHaveTextContent('Unmet');
  expect(progress).toHaveValue('done');
});
it('records comparison history separately and keeps historical progress readable', async () => {
  const { user, area } = await open();
  await user.click(area.getByRole('button', { name: 'Record comparison and action plan' }));
  const saved = await screen.findByRole('region', { name: 'Recorded comparison and action plan' });
  expect(within(saved).getByText(/Marking an action done only reports/)).toBeInTheDocument();
  expect(within(saved).queryByRole('combobox')).not.toBeInTheDocument();
});
it('does not replace a dirty interview form with a comparison action', async () => {
  const { user, area } = await open();
  await user.selectOptions(screen.getByLabelText('Answer status'), 'known');
  await user.type(screen.getByLabelText('Birth date'), '1996-11-12');
  expect(area.getByRole('button', { name: 'Record comparison and action plan' })).toBeDisabled();
  expect(
    area
      .getAllByRole('button', { name: 'Open related evidence group' })
      .every((b) => b.hasAttribute('disabled')),
  ).toBe(true);
  expect(screen.getByLabelText('Birth date')).toHaveValue('1996-11-12');
});
it('retries the exact progress request after an uncertain response', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/comparison/', async ({ request }) => {
      bodies.push(await request.json());
      if (bodies.length === 1) return HttpResponse.json({ detail: 'Interrupted' }, { status: 503 });
      return HttpResponse.json({
        revision: 1,
        answers: {},
        comparison: { ...fixture, context: { ...fixture.context, session_revision: 1 } },
      });
    }),
  );
  const { user, area } = await open();
  const progress = area.getAllByLabelText(/Progress: Review unmet condition/)[0];
  if (!progress) throw new Error('Expected a real unresolved action');
  await user.selectOptions(progress, 'in_progress');
  await user.click(await area.findByRole('button', { name: 'Retry the same save request' }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[1]).toEqual(bodies[0]);
});
it('refreshes both comparison and interview context after another tab changes revision', async () => {
  let changed = false;
  const gets: string[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/:id/calculators/comparison/', () => {
      changed = true;
      return HttpResponse.json({ detail: 'Changed' }, { status: 409 });
    }),
    http.get('/api/applicant/v1/assessments/:id/calculators/comparison/', () => {
      gets.push('comparison');
      return HttpResponse.json({
        ...fixture,
        context: { ...fixture.context, session_revision: changed ? 4 : 0 },
      });
    }),
    http.get('/api/applicant/v1/assessments/:id/calculators/interview/', () => {
      gets.push('interview');
      return HttpResponse.json({
        revision: changed ? 4 : 0,
        answers: {},
        adapter_version: 'calculator-interview-1',
        ruleset_sha256: 'a'.repeat(64),
        sources: { canada: { sha256: 'b'.repeat(64) }, australia: { sha256: 'c'.repeat(64) } },
      });
    }),
  );
  const { user, area } = await open();
  await user.click(
    area.getByRole('checkbox', { name: 'Canada — Federal Skilled Trades (unsupported)' }),
  );
  await user.click(area.getByRole('button', { name: 'Save comparison routes' }));
  await area.findByText(/Answers, sources or versions changed/);
  await user.click(
    area.getByRole('button', { name: 'Discard pending request and reload its status' }),
  );
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Save comparison routes' })).toBeEnabled(),
  );
  expect(gets.filter((x) => x === 'interview').length).toBeGreaterThan(1);
  expect(gets.filter((x) => x === 'comparison').length).toBeGreaterThan(1);
});

it('keeps hypothetical nomination points separate from the actual comparison score', async () => {
  const copy = structuredClone(fixture) as Comparison;
  const first = copy.routes[0];
  if (!first) throw new Error('Expected a route fixture');
  first.conditional_points = [
    { kind: 'confirmed_nomination', hypothetical: true, score: 1024, delta: 600 },
  ];
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/comparison/', () =>
      HttpResponse.json(copy),
    ),
  );
  const { area } = await open();
  expect(area.getAllByText('CRS score: 424', { exact: false })).toHaveLength(2);
  expect(
    area.getByText(/Hypothetical score only if the condition above is fulfilled: 1024/),
  ).toBeInTheDocument();
  expect(area.getByText(/obtain a valid confirmed nomination/)).toBeInTheDocument();
});

it('rejects unsafe source links returned in a saved manifest', async () => {
  const copy = structuredClone(fixture) as Comparison;
  const source = copy.sources.canada.manifest.sources.fsw;
  if (!source) throw new Error('Expected an official source fixture');
  source.url = 'javascript:alert(1)';
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/comparison/', () =>
      HttpResponse.json(copy),
    ),
  );
  const { user, area } = await open();
  await user.click(area.getByText('Sources and review dates', { selector: 'summary' }));
  expect(area.getByText('fsw', { selector: 'a' })).not.toHaveAttribute('href');
});
