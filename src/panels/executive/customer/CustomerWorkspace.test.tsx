import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('scorize.mock.session', '2');
  await i18n.changeLanguage('en');
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
