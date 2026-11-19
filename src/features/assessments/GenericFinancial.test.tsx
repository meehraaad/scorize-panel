import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import { renderApp } from '@/test/renderApp';
import fixture from '@/mocks/calculator-financial.json';
import destinations from '@/mocks/destination-result.json';
import { FinancialPolicyEditor, FinancialScenarioEditor } from './FinancialPolicyEditor';
import { DestinationPolicyEditor } from './DestinationPolicyEditor';
import { upgradeFinancialPolicy } from './financialCatalog';
import type { CurrencyCatalog, FinancialPolicy, FinancialScenario } from './financialTypes';
import type { DestinationPolicy } from './destinationApi';

const catalog: CurrencyCatalog = {
  source_url: 'https://example.org/synthetic',
  published_on: '2026-11-01',
  received_at: '2026-11-01T00:00:00Z',
  sha256: 'a'.repeat(64),
  currencies: [
    { id: 'JPY', minor_units: 0, name: 'Yen' },
    { id: 'GBP', minor_units: 2, name: 'Pound Sterling' },
  ],
};
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test fixture');
  return value;
}
function component(policy: FinancialPolicy | undefined) {
  return required(required(required(policy).routes[0]).components[0]);
}
function generic(): FinancialPolicy {
  const p = upgradeFinancialPolicy(fixture.policy.bundle as FinancialPolicy, catalog, {});
  p.routes[0] = {
    ...required(p.routes[0]),
    id: 'jp-study',
    country: 'JP',
    goal: 'study',
    title: { fa: 'ژاپن آزمایشی', en: 'Synthetic Japan' },
  };
  return p;
}
beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.setItem('scorize.mock.session', '1');
});
it('upgrades explicitly, preserves whole-unit amounts, and creates country targets without route-code changes', async () => {
  let saved: FinancialPolicy | undefined;
  function Harness() {
    const [p, set] = useState(fixture.policy.bundle as FinancialPolicy);
    saved = p;
    return (
      <FinancialPolicyEditor
        value={p}
        onChange={set}
        catalog={catalog}
        countries={[{ code: 'JP', name: 'Japan' }]}
      />
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  const upgrade = await screen.findByRole('button', {
    name: 'Enable country-independent financial targets',
  });
  expect(screen.queryByLabelText('Destination country')).not.toBeInTheDocument();
  await user.click(upgrade);
  expect(saved?.schema_version).toBe(2);
  expect(component(saved).amount_unit).toBe('major');
  expect(component(saved).amount).toBe(component(fixture.policy.bundle as FinancialPolicy).amount);
  await user.click(screen.getByRole('button', { name: 'Add route cost table' }));
  const country = required(screen.getAllByLabelText('Destination country').at(-1));
  await user.selectOptions(country, 'JP');
  expect(saved?.routes.at(-1)?.country).toBe('JP');
  expect(saved?.routes.at(-1)?.goal).toBe('study');
});
it('captures selected currency precision and requires an explicit major/minor choice', async () => {
  let saved: FinancialPolicy | undefined;
  function Harness() {
    const [p, set] = useState(generic());
    saved = p;
    return <FinancialPolicyEditor value={p} onChange={set} catalog={catalog} />;
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(
    screen.getByText(component(fixture.policy.bundle as FinancialPolicy).id, { exact: true }),
  );
  await user.selectOptions(screen.getByLabelText('Currency'), 'GBP');
  await user.selectOptions(screen.getByLabelText('Amount unit'), 'minor');
  expect(saved?.currencies).toContainEqual({ id: 'GBP', minor_units: 2 });
  expect(component(saved).amount_unit).toBe('minor');
  await user.selectOptions(screen.getByLabelText('Currency'), 'IRR');
  expect(screen.getByLabelText('Amount unit')).toHaveValue('major');
  expect(screen.queryByRole('option', { name: 'Minor currency unit' })).not.toBeInTheDocument();
});
it('uses generic targets in independently supplied reference cases', () => {
  let saved: FinancialScenario[] = [];
  const policy = generic();
  function Harness() {
    const [cases, set] = useState<FinancialScenario[]>([
      { route_id: 'jp-study', inputs: {}, expected: { status: 'unknown', ask_exact: false } },
    ]);
    saved = cases;
    return <FinancialScenarioEditor policy={policy} cases={cases} onChange={set} />;
  }
  render(<Harness />);
  expect(screen.getByLabelText('Route')).toHaveValue('jp-study');
  expect(screen.getByRole('option', { name: 'Synthetic Japan' })).toBeInTheDocument();
  expect(required(saved[0]).expected.status).toBe('unknown');
});
it('filters financial bindings by country and goal and clears a binding on a scope change', async () => {
  let saved: DestinationPolicy | undefined;
  const policy = structuredClone(destinations.intake.catalog.bundle) as DestinationPolicy;
  policy.entries = [
    { ...required(policy.entries[2]), country: 'JP', financial_route_id: 'jp-study' },
  ];
  function Harness() {
    const [p, set] = useState(policy);
    saved = p;
    return (
      <DestinationPolicyEditor
        value={p}
        onChange={set}
        countries={[
          { code: 'JP', name: 'Japan' },
          { code: 'GB', name: 'United Kingdom' },
        ]}
        financialTargets={[
          {
            id: 'jp-study',
            country: 'JP',
            goal: 'study',
            title: { fa: 'ژاپن آزمایشی', en: 'Synthetic Japan' },
          },
          { id: 'wrong', country: 'GB', goal: 'study', title: { fa: 'دیگر', en: 'Wrong country' } },
        ]}
      />
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByText(required(policy.entries[0]).title.fa, { exact: true }));
  expect(screen.getByLabelText('Financial target')).toHaveValue('jp-study');
  expect(screen.queryByRole('option', { name: 'Wrong country' })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Destination country'), 'GB');
  expect(required(required(saved).entries[0]).financial_route_id).toBeNull();
  expect(screen.getByRole('option', { name: 'Wrong country' })).toBeInTheDocument();
});
it('selects the first recorded generic target and sends its ID in a read-only scenario', async () => {
  const result = fixture.routes['ca-fsw'];
  let request: Record<string, unknown> | undefined;
  server.use(
    http.get('/api/applicant/v1/assessments/:id/calculators/financial/', () =>
      HttpResponse.json({
        ...fixture,
        policy: { ...fixture.policy, bundle: generic() },
        targets: [
          {
            id: 'jp-study',
            country: 'JP',
            goal: 'study',
            title: { fa: 'ژاپن آزمایشی', en: 'Synthetic Japan' },
          },
        ],
        routes: { 'jp-study': result },
      }),
    ),
    http.post(
      '/api/applicant/v1/assessments/:id/calculators/financial/scenario/',
      async ({ request: r }) => {
        request = (await r.json()) as Record<string, unknown>;
        return HttpResponse.json({
          before: result,
          after: result,
          writes: false,
          hypothetical: true,
        });
      },
    ),
  );
  renderApp('/dev/assessment-calculators');
  const user = userEvent.setup();
  await user.selectOptions(
    await screen.findByLabelText('Previous sessions'),
    '11111111-1111-4111-8111-111111111111',
  );
  await screen.findByLabelText('Evidence group');
  const area = within(screen.getByRole('region', { name: 'Financial fit' }));
  await user.click(area.getByRole('button', { name: 'Open financial questions' }));
  await area.findByText(/Assessment date/);
  expect(area.getByLabelText('Route')).toHaveValue('jp-study');
  await user.clear(area.getByLabelText('Exact spending budget (Tomans)'));
  await user.type(area.getByLabelText('Exact spending budget (Tomans)'), '999');
  await user.click(area.getByRole('button', { name: 'Preview hypothetical financial change' }));
  await area.findByText(/Hypothetical/);
  expect(request?.route_id).toBe('jp-study');
});
