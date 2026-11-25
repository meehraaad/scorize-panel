import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import { Team } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import type { CustomerWorkspace } from './api';

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('scorize.mock.session', '2');
  await i18n.changeLanguage('en');
});

const writingOnly: CustomerWorkspace = {
  id: 1240,
  name: 'Writing customer',
  case: null,
  services: [],
  service_tabs: [],
  writing: [{ id: 1240, kind: 'sop', state: 'new' }],
  open_tasks: 0,
  next_task: null,
  contract_state: null,
  can_change_contract: false,
  can_edit_information: false,
};

function mockWritingOnlyWorkspace() {
  server.use(
    http.get('/api/executive/v1/customers/1240/workspace/', () => HttpResponse.json(writingOnly)),
  );
}

it('uses the shared header and keeps empty case tabs in place for managers', async () => {
  mockWritingOnlyWorkspace();
  const user = userEvent.setup();
  const router = renderApp('/executive/customers/1240');
  expect(await screen.findByRole('region', { name: 'Order summary' })).toBeVisible();
  expect(router.state.location.pathname).toBe('/executive/customers/1240/desk/writing');

  const header = screen.getByRole('region', { name: 'File summary' });
  expect(within(header).getByRole('heading', { name: writingOnly.name })).toBeVisible();
  const navigation = screen.getByRole('navigation', { name: 'Customer workspace' });
  expect(
    within(navigation)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual([
    'Work Desk',
    'Tasks',
    'Summary',
    'Contract & Payments',
    'Information',
    'Documents',
    'Reports',
  ]);

  await user.click(within(navigation).getByRole('link', { name: 'Contract & Payments' }));
  expect(
    await screen.findByText('There is no case contract or case payment history to show.'),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe('/executive/customers/1240/contract');

  const currentNavigation = screen.getByRole('navigation', { name: 'Customer workspace' });
  await user.click(within(currentNavigation).getByRole('link', { name: 'Documents' }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/executive/customers/1240/documents'),
  );
  expect(
    await screen.findByText('There are no case documents for this customer yet.'),
  ).toBeVisible();
});

it('keeps case tabs hidden and redirects direct links for staff without case access', async () => {
  mockWritingOnlyWorkspace();
  server.use(
    http.get('/api/profile/auth/v1/whoami/', () =>
      HttpResponse.json({
        id: 2,
        first_name: 'Maryam',
        last_name: 'Kazemi',
        email: 'maryam@example.test',
        phone_number: null,
        staff: { id: 7, full_name: 'Maryam Kazemi', is_active: true, team: Team.WRITING },
        is_superuser: false,
        permissions: [{ codename: 'can_write_sop' }],
        group_permissions: [],
        applicant: null,
        is_country_supervisor: false,
        executive_panel: true,
        last_workspace: 'executive',
        workspace_mode: 'last',
      } satisfies SessionUser),
    ),
  );
  const router = renderApp('/executive/customers/1240/contract');
  expect(await screen.findByRole('region', { name: 'Order summary' })).toBeVisible();
  expect(router.state.location.pathname).toBe('/executive/customers/1240/desk/writing');
  const navigation = screen.getByRole('navigation', { name: 'Customer workspace' });
  expect(
    within(navigation)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Work Desk', 'Tasks']);
  expect(screen.getByRole('region', { name: 'File summary' })).toBeVisible();
});

it('opens a customer on Work Desk and lets staff see completed tasks separately', async () => {
  const user = userEvent.setup();
  const router = renderApp('/executive/customers/1240');
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/executive/customers/1240/desk/124000'),
  );
  // Look the tabs up once the first service's desk has rendered: the workspace frame re-renders on
  // the way there, and an element found earlier can be detached (clicking it does nothing).
  await screen.findByText(/Applications in/);
  const navigation = await screen.findByRole('navigation', { name: 'Customer workspace' });
  expect(within(navigation).getByRole('link', { name: 'Work Desk' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await user.click(within(navigation).getByRole('link', { name: /Tasks/ }));
  await user.click(await screen.findByRole('button', { name: /Completed/ }));
  expect(await screen.findByText('Saved the contract')).toBeVisible();
  expect(router.state.location.pathname).toBe('/executive/customers/1240/tasks');
});

it('requires a termination reason before changing the contract status in Reports', async () => {
  const user = userEvent.setup();
  renderApp('/executive/customers/1240/reports');
  await user.selectOptions(await screen.findByLabelText('Contract status'), 'terminated');
  const submit = screen.getByRole('button', { name: 'Terminate contract and disable access' });
  expect(submit).toBeDisabled();
  await user.type(screen.getByLabelText('Termination reason'), 'The customer cancelled.');
  await user.click(submit);
  expect(await screen.findByText('Contract status updated.')).toBeVisible();
});
