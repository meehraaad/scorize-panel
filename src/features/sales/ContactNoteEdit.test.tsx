import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { fetchCustomer } from '@/mocks/legacy/customer';
import { contactNoteRow } from '@/mocks/staff';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';
import { clearContactDrafts } from '@/lib/sales/contactDrafts';

const customer = '/sales/customers/105';
const apiPath = '/api/sales/v1/customers/105';
const editLabel = /^ویرایش توضیح /;
const description = () => screen.getByRole('textbox', { name: 'چه گذشت؟' });
function entryFor(text: HTMLElement) {
  const entry = text.closest('li');
  if (!entry) throw new Error('Expected a history entry');
  return within(entry);
}

beforeEach(async () => {
  localStorage.setItem('scorize.mock.session', '3');
  clearContactDrafts();
  await i18n.changeLanguage('fa');
});

it('edits a contact description and leaves other sellers’ text read-only', async () => {
  const user = userEvent.setup();
  renderApp(customer);
  const history = await screen.findByRole('region', { name: 'تاریخچه' });
  const own = await within(history).findByText(/^بعد از مشاوره زنگ زدم/);
  const entry = entryFor(own);
  const colleague = await within(history).findByText(/^پیشنهاد مشاور: ۶ اپلای هلند/);
  expect(entryFor(colleague).queryByRole('button', { name: editLabel })).toBeNull();
  const edit = entry.getByRole('button', { name: editLabel });
  // Icon only, after the entry's text.
  expect(edit).toHaveTextContent('');
  expect(own.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await user.click(edit);
  expect(description()).toHaveValue(own.textContent);
  expect(description()).toHaveFocus();
  expect(entry.queryByRole('button', { name: editLabel })).toBeNull();
  await user.clear(description());
  await user.type(description(), 'Discarded');
  await user.click(entry.getByRole('button', { name: 'لغو' }));
  expect(entry.queryByRole('textbox')).toBeNull();
  expect(entry.getByText(own.textContent)).toBeInTheDocument();
  await waitFor(() => expect(entry.getByRole('button', { name: editLabel })).toHaveFocus());
  await user.keyboard('{Enter}');
  await user.type(description(), ' more');
  await user.keyboard('{Escape}');
  expect(entry.queryByRole('textbox')).toBeNull();
  await user.click(entry.getByRole('button', { name: editLabel }));
  await user.clear(description());
  await user.type(description(), 'Updated description');
  await user.click(entry.getByRole('button', { name: 'ذخیره' }));
  expect(await entry.findByText('Updated description')).toBeInTheDocument();
  expect(await toasts().findByText('توضیح ذخیره شد.')).toBeInTheDocument();
});

it('preserves a draft through a failed save and requires review of a concurrent edit', async () => {
  const user = userEvent.setup();
  renderApp(customer);
  const history = await screen.findByRole('region', { name: 'تاریخچه' });
  const own = await within(history).findByText(/^بعد از مشاوره زنگ زدم/);
  const entry = entryFor(own);
  await user.click(entry.getByRole('button', { name: editLabel }));
  await user.clear(description());
  await user.type(description(), 'My draft');

  server.use(http.patch(`${apiPath}/contacts/5/`, () => HttpResponse.error(), { once: true }));
  const save = entry.getByRole('button', { name: 'ذخیره' });
  await user.click(save);
  expect(await toasts().findByText(/توضیح ذخیره نشد/)).toBeInTheDocument();
  expect(description()).toHaveValue('My draft');
  const row = contactNoteRow(105, 5);
  if (!row) throw new Error('Expected seeded contact');
  row.notes = 'Concurrent description';
  await user.click(save);
  expect(await entry.findByText('Concurrent description')).toBeInTheDocument();
  expect(save).toBeDisabled();
  expect(description()).toHaveValue('My draft');
  await user.click(entry.getByRole('button', { name: 'پیش‌نویسم را نگه دار' }));
  expect(save).toBeEnabled();
  await user.click(save);
  expect(await entry.findByText('My draft')).toBeInTheDocument();
});

it.each([
  { phone: '+۹۸٩١۲۳۴۵۶۷۸۹', copied: '+989123456789', failed: false },
  { phone: '۰٩١۲۳۴۵۶۷۸۹', copied: '09123456789', failed: true },
])('copies $phone as $copied and shows clipboard feedback', async ({ phone, copied, failed }) => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText');
  if (failed) write.mockRejectedValueOnce(new Error('Clipboard unavailable'));
  server.use(
    http.get(`${apiPath}/`, async () =>
      HttpResponse.json({ ...(await fetchCustomer(105)), phone }),
    ),
  );
  renderApp(`${customer}?log=call`);
  const dialog = await screen.findByRole('dialog');
  await user.click(await within(dialog).findByRole('button', { name: 'کپی شماره' }));
  expect(write).toHaveBeenCalledWith(copied);
  expect(
    await toasts().findByText(failed ? 'شماره تلفن کپی نشد.' : 'شماره تلفن کپی شد.'),
  ).toBeInTheDocument();
  expect(dialog).toBeInTheDocument();
});
