import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import type { DraftInput } from './api';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { enableProgramFixture, changeProgramDefinitionFixture } from '@/mocks/destinations';
const ID = '22222222-2222-4222-8222-222222222222';
const TITLE = 'Configured check — Germany — synthetic route';
beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '1');
  await i18n.changeLanguage('en');
  enableProgramFixture();
});
async function open() {
  const user = userEvent.setup();
  renderApp(`/dev/assessment-destinations?session=${ID}`);
  const region = await screen.findByRole('region', { name: TITLE });
  return { user, area: within(region) };
}
async function age(
  user: ReturnType<typeof userEvent.setup>,
  area: Awaited<ReturnType<typeof open>>['area'],
  value = '30',
) {
  await user.selectOptions(area.getByLabelText('Answer status — Synthetic age'), 'known');
  await user.type(area.getByLabelText('Synthetic age'), value);
  await user.click(area.getByRole('button', { name: 'Save program answer — Synthetic age' }));
  await waitFor(() =>
    expect(
      area.getByRole('button', { name: 'Save program answer — Synthetic age' }),
    ).toBeDisabled(),
  );
}
it('generates typed questions and conditional visibility without assuming a boolean answer', async () => {
  const { area } = await open();
  expect(area.getByText(/Next useful question: Synthetic age/)).toBeInTheDocument();
  expect(area.getByText(/does not establish visa eligibility/)).toBeInTheDocument();
  expect(area.getByLabelText('Answer status — Synthetic offer')).toHaveValue('unknown');
  expect(area.getByLabelText('Answer status — Synthetic offer category')).toBeDisabled();
  expect(area.getByText(/More information is needed/)).toBeInTheDocument();
});
it('evaluates the configured alternative and capped points after explicit answers', async () => {
  const { user, area } = await open();
  await age(user, area);
  await user.selectOptions(area.getByLabelText('Answer status — Synthetic offer'), 'known');
  expect(area.getByLabelText('Synthetic offer')).toHaveValue('');
  await user.selectOptions(area.getByLabelText('Synthetic offer'), 'true');
  await user.click(area.getByRole('button', { name: 'Save program answer — Synthetic offer' }));
  await area.findByText(/Configured conditions: Configured conditions met/);
  expect(area.getByText(/Configured points: 8/)).toBeInTheDocument();
  expect(area.getByLabelText('Answer status — Synthetic offer category')).toBeEnabled();
});
it('preserves unrelated program edits and blocks recording until they are saved or discarded', async () => {
  const { user, area } = await open();
  await user.selectOptions(area.getByLabelText('Answer status — Synthetic age'), 'known');
  await user.type(area.getByLabelText('Synthetic age'), '31');
  await user.selectOptions(area.getByLabelText('Answer status — Synthetic offer'), 'known');
  await user.selectOptions(area.getByLabelText('Synthetic offer'), 'false');
  await user.click(area.getByRole('button', { name: 'Save program answer — Synthetic offer' }));
  await waitFor(() =>
    expect(
      area.getByRole('button', { name: 'Save program answer — Synthetic offer' }),
    ).toBeDisabled(),
  );
  expect(area.getByLabelText('Synthetic age')).toHaveValue(31);
  expect(screen.getByRole('button', { name: 'Record this destination shortlist' })).toBeDisabled();
  expect(screen.getByLabelText('Answer status — Migration goals')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Discard all unsaved program answers' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record this destination shortlist' })).toBeEnabled(),
  );
});
it('retains an invalid blank numeric answer after a controlled 400 and allows an explicit correction', async () => {
  const { user, area } = await open();
  await user.selectOptions(area.getByLabelText('Answer status — Synthetic age'), 'known');
  await user.click(area.getByRole('button', { name: 'Save program answer — Synthetic age' }));
  await screen.findByRole('button', { name: 'Discard pending request and reload its status' });
  expect(area.getByLabelText('Synthetic age')).toHaveValue(null);
  await user.click(
    screen.getByRole('button', { name: 'Discard pending request and reload its status' }),
  );
  await waitFor(() => expect(area.getByLabelText('Synthetic age')).toBeEnabled());
  await user.type(area.getByLabelText('Synthetic age'), '30');
  await user.click(area.getByRole('button', { name: 'Save program answer — Synthetic age' }));
  await waitFor(() =>
    expect(
      area.getByRole('button', { name: 'Save program answer — Synthetic age' }),
    ).toBeDisabled(),
  );
});
it('keeps prior values unconfirmed until explicit program adoption and a fresh answer', async () => {
  const { user, area } = await open();
  await age(user, area);
  changeProgramDefinitionFixture();
  await user.click(screen.getByRole('button', { name: 'Refresh destination review' }));
  await area.findByText(/This program definition changed/);
  await user.click(area.getByRole('button', { name: 'Confirm the current program definition' }));
  await area.findByText('Previous unconfirmed answer: 30');
  expect(area.getByLabelText('Answer status — Synthetic age')).toHaveValue('needs_confirmation');
  await age(user, area, '31');
});
it('does not calculate or accept answers outside program source coverage', async () => {
  enableProgramFixture('program_date_out_of_coverage');
  const { area } = await open();
  expect(area.getByText(/outside this program’s declared coverage/)).toBeInTheDocument();
  expect(area.getByLabelText('Answer status — Synthetic age')).toBeDisabled();
  expect(
    area.queryByText(/Configured conditions: Configured conditions met/),
  ).not.toBeInTheDocument();
});
it('records a configured result with read-only historical answers', async () => {
  const { user, area } = await open();
  await age(user, area);
  await user.click(screen.getByRole('button', { name: 'Record this destination shortlist' }));
  await waitFor(() => expect(screen.getAllByRole('region', { name: TITLE })).toHaveLength(2));
  const region = screen.getAllByRole('region', { name: TITLE })[1];
  if (!region) throw new Error('Missing historical program check');
  expect(within(region).queryByRole('button')).not.toBeInTheDocument();
  expect(within(region).queryByRole('combobox')).not.toBeInTheDocument();
  expect(within(region).getByText(/Synthetic age/)).toBeInTheDocument();
});
it('authors a numeric condition and independent program case through the shared structured editor', async () => {
  localStorage.setItem('scorize.mock.session', '4');
  const user = userEvent.setup();
  const bodies: DraftInput[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/drafts/'))
      void request
        .clone()
        .json()
        .then((value) => bodies.push(value as DraftInput));
  });
  renderApp('/dev/assessments');
  await user.click(await screen.findByRole('button', { name: 'New draft' }));
  await user.click(screen.getByRole('button', { name: 'Add destination catalog' }));
  const summary = screen.getByText('آلمان — گزینهٔ مصنوعی', { selector: 'summary' });
  await user.click(summary);
  const detail = summary.closest('details');
  if (!detail) throw new Error('Missing entry editor');
  const entry = within(detail);
  await user.click(entry.getByRole('button', { name: 'Add configurable program rules' }));
  const programSummary = entry.getByText('Configure program questions, conditions and points', {
    selector: 'summary',
  });
  const programDetail = programSummary.closest('details');
  if (!programDetail) throw new Error('Missing program editor');
  const program = within(programDetail);
  expect(program.queryByLabelText('Definition type')).not.toBeInTheDocument();
  await user.type(program.getByLabelText('Definition ID (Latin)'), 'age');
  await user.type(program.getByLabelText('Definition name'), 'Synthetic age');
  const toolsRoot = program.getByLabelText('Definition ID (Latin)').closest('div.rounded-2xl');
  if (!(toolsRoot instanceof HTMLElement)) throw new Error('Missing definition creation controls');
  await user.selectOptions(within(toolsRoot).getByLabelText('Answer type'), 'number');
  await user.click(program.getByRole('button', { name: 'Add question' }));
  await user.selectOptions(program.getByRole('combobox', { name: 'Question' }), 'age');
  await user.selectOptions(program.getByLabelText('Comparison'), 'gte');
  await user.clear(program.getByRole('spinbutton', { name: 'Synthetic age' }));
  await user.type(program.getByRole('spinbutton', { name: 'Synthetic age' }), '18');
  await user.click(screen.getByRole('button', { name: 'Add independent program case' }));
  expect(screen.getByLabelText('Expected configured conditions')).toHaveValue(
    'insufficient_information',
  );
  for (const [label, value] of Object.entries({
    'Program source title': 'Synthetic rules only',
    'Program source HTTPS URL': 'https://example.org/program',
    'Program source checked on': '2026-11-01',
    'Program source review due': '2026-12-30',
    'Program source receipt (with timezone)': '2026-11-01T00:00:00Z',
    'Program rules effective on': '2026-11-01',
    'Program assessment coverage from': '2026-11-01',
    'Program assessment coverage through': '2026-12-30',
  }))
    await user.type(program.getByLabelText(label), value);
  await user.type(screen.getByLabelText('Draft title'), 'Configured program builder');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  const sent = bodies[0];
  expect(
    sent?.bundle.destination_policy?.entries.find((e) => e.country === 'DE')?.program?.bundle
      .routes[0]?.requirements[0]?.condition,
  ).toEqual({ fact: 'age', op: 'gte', value: 18 });
  expect(sent?.scenarios[0]?.destinations?.[0]?.programs?.['de-study']).toHaveLength(1);
});
