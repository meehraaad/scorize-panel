import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import fixture from '@/mocks/destination-result.json';
const ID = '22222222-2222-4222-8222-222222222222';
beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
});
async function open() {
  const user = userEvent.setup();
  renderApp('/dev/assessment-destinations');
  await user.selectOptions(await screen.findByLabelText('Previous destination reviews'), ID);
  const region = await screen.findByRole('region', { name: 'Your goals and preferences' });
  await within(region).findByText(/Assessment 2026-11-13/);
  return { user, area: within(region) };
}
async function goals(
  user: ReturnType<typeof userEvent.setup>,
  area: Awaited<ReturnType<typeof open>>['area'],
  goal = 'Work',
) {
  await user.selectOptions(area.getByLabelText('Answer status — Migration goals'), 'known');
  await user.click(area.getByText(goal, { exact: true }));
  await user.click(area.getByRole('button', { name: 'Save Migration goals' }));
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Save Migration goals' })).toBeDisabled(),
  );
}
it('keeps current legal coverage, financial unknowns and preference index separate', async () => {
  const { area } = await open();
  expect(area.getAllByText(/Legal reference review is needed/)).toHaveLength(2);
  expect(area.getAllByText(/Detailed eligibility calculator is not implemented/)).toHaveLength(3);
  expect(area.getAllByText(/2026-11-12/)).toHaveLength(2);
  expect(area.getAllByText(/Preference answers are incomplete/)).toHaveLength(5);
  expect(area.queryByRole('link', { name: 'Open detailed assessment' })).not.toBeInTheDocument();
});
it('focuses the declared goal without treating other routes as legally rejected', async () => {
  const { user, area } = await open();
  await goals(user, area);
  expect(area.getByRole('heading', { name: 'Canada — synthetic route' })).toBeInTheDocument();
  expect(
    area.queryByRole('heading', { name: 'Germany — synthetic route' }),
  ).not.toBeInTheDocument();
  await user.click(area.getByText('Show routes outside my current goals', { exact: true }));
  expect(area.getByRole('heading', { name: 'Germany — synthetic route' })).toBeInTheDocument();
  await user.selectOptions(area.getByLabelText('Answer status — Preferred destinations'), 'known');
  await user.selectOptions(area.getByLabelText('Add country — Preferred destinations'), 'CA');
  await user.click(area.getByRole('button', { name: 'Save Preferred destinations' }));
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Save Preferred destinations' })).toBeDisabled(),
  );
  expect(
    area.getByRole('heading', { name: 'Canada — synthetic route' }).closest('article'),
  ).toHaveTextContent('Matches stated preferences');
  expect(
    area.getByRole('heading', { name: 'Australia — synthetic route' }).closest('article'),
  ).toHaveTextContent('Alternative destination');
});
it('explains a missing goal catalog without declaring no migration options', async () => {
  const { user, area } = await open();
  await goals(user, area, 'Family');
  expect(area.getByText(/The catalog has no route for this goal yet/)).toBeInTheDocument();
});
it('preserves unrelated dirty preferences when saving one fact and prevents recording them', async () => {
  const { user, area } = await open();
  await user.selectOptions(area.getByLabelText('Answer status — Current residence'), 'known');
  await user.selectOptions(area.getByLabelText('Current country of residence'), 'DE');
  await goals(user, area);
  expect(area.getByLabelText('Current country of residence')).toHaveValue('DE');
  expect(area.getByRole('button', { name: 'Record this destination shortlist' })).toBeDisabled();
  expect(screen.getByLabelText('Previous destination reviews')).toBeDisabled();
});
it('retries an uncertain write with the exact original UUID and body', async () => {
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/:id/destinations/', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      requests.push(body);
      if (requests.length === 1)
        return HttpResponse.json({ detail: 'Interrupted' }, { status: 503 });
      return HttpResponse.json({
        revision: 1,
        answers: {},
        destinations: {
          ...fixture,
          context: { ...fixture.context, session_revision: 1 },
          intake: { ...fixture.intake, inputs: { goals: { status: 'known', value: ['work'] } } },
        },
      });
    }),
  );
  const { user, area } = await open();
  await user.selectOptions(area.getByLabelText('Answer status — Migration goals'), 'known');
  await user.click(area.getByText('Work', { exact: true }));
  await user.click(area.getByRole('button', { name: 'Save Migration goals' }));
  await user.click(await area.findByRole('button', { name: 'Retry the same save request' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]).toEqual(requests[0]);
});
it('keeps unsaved input across a tab conflict and refreshes the revision', async () => {
  let changed = false;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/destinations/', () => {
      changed = true;
      return HttpResponse.json({ detail: 'Changed' }, { status: 409 });
    }),
    http.get('/api/applicant/v1/assessments/:id/destinations/', () =>
      HttpResponse.json({
        ...fixture,
        context: { ...fixture.context, session_revision: changed ? 4 : 0 },
      }),
    ),
  );
  const { user, area } = await open();
  await user.selectOptions(area.getByLabelText('Answer status — Migration goals'), 'known');
  await user.click(area.getByText('Study', { exact: true }));
  await user.click(area.getByRole('button', { name: 'Save Migration goals' }));
  await area.findByText(/The assessment or reference catalog changed/);
  await user.click(
    area.getByRole('button', { name: 'Discard pending request and reload its status' }),
  );
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Save Migration goals' })).toBeEnabled(),
  );
  expect(area.getByLabelText('Study')).toBeChecked();
});
it('records readable destination history and replays its version', async () => {
  const { user, area } = await open();
  await goals(user, area);
  await user.click(area.getByRole('button', { name: 'Record this destination shortlist' }));
  const saved = await screen.findByRole('region', { name: 'Recorded destination shortlist' });
  expect(
    within(saved).getByRole('heading', { name: 'Germany — synthetic route' }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Replay recorded destination review' }));
  expect(
    await screen.findByText('Replay matches the recorded version and inputs.'),
  ).toBeInTheDocument();
});
it('does not offer a start when the reviewed catalog is unavailable', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/destinations/options/', () =>
      HttpResponse.json({
        catalog: null,
        today: '2026-11-13',
        countries: [],
        sessions: [],
        active: false,
      }),
    ),
  );
  renderApp('/dev/assessment-destinations');
  expect(
    await screen.findByText(/No reviewed destination catalog is available yet/),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start destination review' })).toBeDisabled();
});
it('retries a start request without changing its date or UUID', async () => {
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/destinations/', async ({ request }) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return requests.length === 1
        ? HttpResponse.json({ detail: 'Interrupted' }, { status: 503 })
        : HttpResponse.json({ id: ID, revision: 0 }, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderApp('/dev/assessment-destinations');
  await user.click(await screen.findByRole('button', { name: 'Start destination review' }));
  await user.click(await screen.findByRole('button', { name: 'Retry the same save request' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0]?.assessment_date).toBe('2026-11-13');
});
it('authors a versioned multi-country catalog with independent reference expectations', async () => {
  localStorage.setItem('scorize.mock.session', '4');
  const user = userEvent.setup();
  renderApp('/dev/assessments');
  await user.click(await screen.findByRole('button', { name: 'New draft' }));
  await user.click(screen.getByRole('button', { name: 'Add destination catalog' }));
  expect(screen.getByLabelText('Stable ruleset key (Latin)')).toHaveValue(
    'assessment-destinations',
  );
  expect(screen.getByLabelText('Preference weight — Goal')).toHaveValue(2);
  await user.click(screen.getByText('کانادا — گزینهٔ مصنوعی', { selector: 'summary' }));
  await user.clear(
    within(
      screen
        .getByText('کانادا — گزینهٔ مصنوعی', { selector: 'summary' })
        .closest('details') as HTMLElement,
    ).getByLabelText('Destination title in English'),
  );
  await user.type(
    within(
      screen
        .getByText('کانادا — گزینهٔ مصنوعی', { selector: 'summary' })
        .closest('details') as HTMLElement,
    ).getByLabelText('Destination title in English'),
    'Canada reviewed directory',
  );
  await user.type(screen.getByLabelText('Draft title'), 'Destination catalog test');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByRole('heading', { name: 'Draft' });
  expect(screen.getByRole('button', { name: 'Run tests' })).toBeEnabled();
});
it('opens the selected session and country in the existing detailed interview', async () => {
  renderApp(`/dev/assessment-calculators?session=${ID}&country=australia`);
  expect(await screen.findByLabelText('Country route')).toHaveValue('australia');
  expect(screen.getByLabelText('Evidence group')).toHaveValue('facts.birth_date');
});

it('labels a requested country coverage gap without declaring ineligibility', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/:id/destinations/', () =>
      HttpResponse.json({ ...fixture, coverage_gaps: ['NZ'] }),
    ),
  );
  const { area } = await open();
  expect(
    area.getByText(/New Zealand. This is a coverage gap, not a finding that you are ineligible/),
  ).toBeInTheDocument();
});

it('finishes saving when PostgreSQL reorders JSON object keys and provenance', async () => {
  let inputs: Record<string, unknown> = {};
  let revision = 0;
  server.use(
    http.post('/api/applicant/v1/assessments/:id/destinations/', async ({ request }) => {
      const body = (await request.json()) as { field: string; status: string; value: unknown };
      inputs = {
        ...inputs,
        [body.field]: {
          value: body.value,
          source: 'user',
          status: body.status,
          document_verified: false,
        },
      };
      revision++;
      return HttpResponse.json({
        revision,
        destinations: {
          ...fixture,
          context: { ...fixture.context, session_revision: revision },
          intake: {
            ...fixture.intake,
            inputs: Object.fromEntries(Object.entries(inputs).reverse()),
          },
        },
      });
    }),
  );
  const { user, area } = await open();
  await goals(user, area);
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Record this destination shortlist' })).toBeEnabled(),
  );
  await user.selectOptions(area.getByLabelText('Answer status — Current residence'), 'known');
  await user.selectOptions(area.getByLabelText('Current country of residence'), 'DE');
  await user.click(area.getByRole('button', { name: 'Save Current residence' }));
  await waitFor(() =>
    expect(area.getByRole('button', { name: 'Record this destination shortlist' })).toBeEnabled(),
  );
  expect(area.getByRole('button', { name: 'Save Migration goals' })).toBeDisabled();
  expect(area.getByRole('button', { name: 'Save Current residence' })).toBeDisabled();
});
