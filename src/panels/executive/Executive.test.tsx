import { screen, waitFor } from '@testing-library/react';
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
