import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

const flag = vi.hoisted(() => ({ expanded: true }));

vi.mock('@/lib/applicant/onServer', async (original) => {
  const module = await original<{ ON_SERVER: Record<string, boolean> }>();
  return {
    ON_SERVER: {
      ...module.ON_SERVER,
      get executiveCustomers() {
        return flag.expanded;
      },
    },
  };
});

beforeEach(async () => {
  flag.expanded = true;
  localStorage.clear();
  localStorage.setItem('scorize.mock.session', '2');
  await i18n.changeLanguage('en');
});

it('opens the new Customers tab and uses the existing assigned-customer list', async () => {
  flag.expanded = false;
  const user = userEvent.setup();
  renderApp('/executive');
  const navigation = (
    await screen.findAllByRole('navigation', { name: 'Executive Panel menu' })
  )[0];
  if (!navigation) throw new Error('Executive navigation did not render');
  await user.click(within(navigation).getByRole('link', { name: 'Customers' }));
  await screen.findByRole('heading', { name: 'Customers' });
  const list = await screen.findByRole('region', { name: 'Customer list' });
  expect((await within(list).findAllByRole('link', { name: 'سارا محمدی' }))[0]).toHaveAttribute(
    'href',
    '/executive/customers/1240/desk',
  );
  expect(screen.queryByRole('button', { name: 'Upload CSV' })).not.toBeInTheDocument();
});

it('opens Work Desk from the expanded list without a workspace flag', async () => {
  flag.expanded = false;
  const user = userEvent.setup();
  server.use(
    http.get('/api/profile/auth/v1/whoami/', () =>
      HttpResponse.json({
        id: 2,
        first_name: 'Maryam',
        last_name: 'Kazemi',
        email: 'maryam@example.test',
        phone_number: null,
        staff: { id: 7, full_name: 'Maryam Kazemi', is_active: true, team: 1 },
        is_superuser: false,
        permissions: [],
        group_permissions: [],
        applicant: null,
        is_country_supervisor: false,
        executive_panel: true,
        executive_customers: true,
        last_workspace: 'executive',
        workspace_mode: 'last',
      }),
    ),
  );
  const router = renderApp('/executive/customers');
  expect(await screen.findByRole('searchbox', { name: 'Search customers' })).toBeVisible();
  expect(await screen.findByRole('columnheader', { name: 'My next task' })).toBeInTheDocument();
  const [customer] = await screen.findAllByRole('link', { name: 'سارا محمدی' });
  if (!customer) throw new Error('Customer link did not render');
  expect(customer).toHaveAttribute('href', '/executive/customers/1240/desk');
  await user.click(customer);
  const workspace = await screen.findByRole('navigation', { name: 'Customer workspace' });
  expect(within(workspace).getByRole('link', { name: 'Work Desk' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(router.state.location.pathname).toMatch(/^\/executive\/customers\/1240\/desk\b/);
});

it('switches scope, pages through customers and resets to page one when filtering by a queue', async () => {
  const user = userEvent.setup();
  const router = renderApp('/executive/customers');
  await user.click(await screen.findByRole('button', { name: /My team/ }));
  await user.click(await screen.findByRole('button', { name: 'Go to page 2' }));
  const result = await screen.findAllByRole('link', { name: 'امید رضوانی' });
  expect(result[0]).toHaveAttribute('href', '/executive/customers/1218/desk');
  await user.click(screen.getByRole('button', { name: /Due today/ }));
  await waitFor(() => expect(router.state.location.search).toBe('?scope=team&queue=today'));
  const matching = await screen.findAllByRole('link', { name: 'سارا محمدی' });
  expect(matching[0]).toHaveAttribute('href', '/executive/customers/1240/desk');
  expect(await screen.findByRole('link', { name: 'Export CSV' })).toHaveAttribute(
    'href',
    '/api/executive/v1/customers/export/?scope=team&queue=today',
  );
});

it('previews skipped rows before applying the authorized customer CSV updates', async () => {
  const user = userEvent.setup();
  renderApp('/executive/customers');
  await user.click(await screen.findByRole('button', { name: 'Upload CSV' }));
  const dialog = await screen.findByRole('dialog');
  await user.upload(
    within(dialog).getByLabelText('Choose CSV file'),
    new File(['applicant_id,name\n1240,Sara'], 'customers.csv', { type: 'text/csv' }),
  );
  expect(await within(dialog).findByText('Rows skipped')).toBeVisible();
  await user.click(within(dialog).getByRole('button', { name: 'Apply updates' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('Customer records updated: 1')).toBeVisible();
});

it('hides CSV upload whenever the account lacks the supervisor-service capability', async () => {
  server.use(
    http.get('/api/executive/v1/customers/', () =>
      HttpResponse.json({
        scopes: { mine: 0 },
        queues: { today: 0, late: 0, review: 0, reply: 0, unassigned: 0 },
        options: { country: [], contract: [], service: [] },
        can_export: false,
        can_import: false,
        count: 0,
        page_size: 20,
        results: [],
      }),
    ),
  );
  renderApp('/executive/customers');
  await screen.findByText('No customers match these filters.');
  expect(screen.queryByRole('button', { name: 'Upload CSV' })).not.toBeInTheDocument();
});
