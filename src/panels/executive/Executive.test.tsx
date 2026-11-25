import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { clearCaseChats } from '@/lib/supervisor/caseChats';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

beforeEach(async () => {
  localStorage.clear();
  clearCaseChats();
  await i18n.changeLanguage('en');
  localStorage.setItem('scorize.mock.session', '2');
});

it('opens the writing conversation in a floating window and restores an unsent reply', async () => {
  const user = userEvent.setup();
  const router = renderApp('/executive/tickets');
  expect(await screen.findByText(/پرسش درباره پذیرش/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Writing' }));
  const row = await screen.findByRole('button', { name: /پرسش درباره انگیزه‌نامه/ });
  expect(screen.queryByText(/پرسش درباره پذیرش/)).not.toBeInTheDocument();
  await user.click(row);
  const dialog = await screen.findByRole('dialog', { name: 'سارا محمدی' });
  expect(await within(dialog).findByText(/فقط پاراگراف آخر هم کمی کوتاه‌تر شود/)).toBeVisible();
  expect(router.state.location.pathname).toBe('/executive/tickets');

  const reply = 'I’ll shorten the last paragraph.';
  await user.type(within(dialog).getByRole('textbox'), reply);
  await user.click(within(dialog).getByRole('button', { name: 'Minimize chat' }));
  expect(screen.queryByRole('dialog', { name: 'سارا محمدی' })).toBeNull();
  await user.click(screen.getByRole('button', { name: /^Open chat with سارا محمدی/ }));
  const reopened = within(await screen.findByRole('dialog', { name: 'سارا محمدی' }));
  expect(await reopened.findByRole('textbox')).toHaveValue(reply);
  await user.click(reopened.getByRole('button', { name: 'Send' }));
  expect(await reopened.findByText(reply)).toBeVisible();
});
