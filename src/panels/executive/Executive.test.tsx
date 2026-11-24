import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  localStorage.setItem('scorize.mock.session', '2');
});

it('groups the customer’s services and opens a filtered Work Table from the summary', async () => {
  const user = userEvent.setup();
  renderApp('/executive');
  await user.click(await screen.findByRole('link', { name: 'Writing' }));
  await screen.findByRole('heading', { name: 'Work Table' });
  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
  expect(within(table).getByRole('link', { name: 'SOP' })).toHaveAttribute(
    'href',
    '/writer/orders/1240',
  );
  expect(within(table).queryByRole('link', { name: 'پذیرش' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'All services' }));
  expect(await within(table).findByRole('link', { name: 'پذیرش' })).toHaveAttribute(
    'href',
    '/executive/customers/1240/desk',
  );
  expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
  await user.click(within(table).getByRole('link', { name: 'سارا محمدی' }));
  const workspace = await screen.findByRole('navigation', { name: 'Customer workspace' });
  expect(within(workspace).getByRole('link', { name: 'Work Desk' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

it('switches departments and opens the writing message on its existing order thread', async () => {
  const user = userEvent.setup();
  const router = renderApp('/executive/tickets');
  expect(await screen.findByText(/پرسش درباره پذیرش/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Writing' }));
  const row = await screen.findByRole('button', { name: /پرسش درباره انگیزه‌نامه/ });
  expect(screen.queryByText(/پرسش درباره پذیرش/)).not.toBeInTheDocument();
  await user.click(row);
  await waitFor(() => expect(router.state.location.pathname).toBe('/writer/orders/1240/tickets'));
});
