import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { clearContactDrafts } from '@/lib/sales/contactDrafts';
import { fetchCustomer } from '@/mocks/legacy/customer';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

/*
 * Sending a ready message never strands the seller: each message can be copied, Telegram's text
 * also waits on the clipboard, and a customer with no mobile number gets no app link at all
 * (a link to "t.me/+98" opens nobody's chat).
 */
const customer = '/sales/customers/105';
const apiPath = '/api/sales/v1/customers/105';
const TEMPLATES = [{ id: 1, title: 'یادآوری', text: 'سلام عرفان عزیز 🌹', own: true }];

/** The customer as the sales mock answers it (src/mocks/salesStaff.ts), with `fields` changed. */
function withCustomer(fields: Record<string, unknown>) {
  server.use(
    http.get(`${apiPath}/`, async () => {
      const data = await fetchCustomer(105);
      return HttpResponse.json({
        ...data,
        supports: { ...data.supports, no_answer_send: true },
        ...fields,
      });
    }),
  );
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('scorize.mock.session', '3');
  clearContactDrafts();
  await i18n.changeLanguage('fa');
});

afterEach(() => vi.restoreAllMocks());

describe('ready message picker', () => {
  it('copies a message without opening the app', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    renderApp(customer);
    await user.click(await screen.findByRole('button', { name: /^تلگرام به / }));
    const picker = await screen.findByRole('dialog', { name: 'کدام پیام در تلگرام نوشته شود؟' });
    const [copy] = within(picker).getAllByRole('button', { name: /^کپی متن / });
    await user.click(copy as HTMLElement);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('سلام'));
    expect(await toasts().findByText('متن پیام کپی شد.')).toBeInTheDocument();
    expect(picker).toBeInTheDocument();
  });

  it('with no mobile number: no app links, the texts to copy', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    withCustomer({ phone: '', templates: TEMPLATES });
    renderApp(customer);
    await user.click(await screen.findByRole('button', { name: /^واتساپ به / }));
    const picker = await screen.findByRole('dialog', { name: 'کدام پیام در واتساپ نوشته شود؟' });
    expect(within(picker).getByText(/شماره‌ی موبایل معتبری ندارد/)).toBeInTheDocument();
    expect(within(picker).queryByRole('link', { name: /سلام|بدون پیام آماده/ })).toBeNull();
    for (const link of within(picker).queryAllByRole('link'))
      expect(link.getAttribute('href')).not.toMatch(/whatsapp|t\.me/);
    const [copy] = within(picker).getAllByRole('button', { name: /^کپی متن / });
    await user.click(copy as HTMLElement);
    expect(write).toHaveBeenCalled();
  });

  it('with no mobile number and no ready message: the buttons are off', async () => {
    withCustomer({ phone: '', templates: [] });
    renderApp(customer);
    expect(await screen.findByRole('button', { name: /^واتساپ به / })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^تلگرام به / })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /^(واتساپ|تلگرام) به / })).toBeNull();
  });
});

describe('contact log', () => {
  async function noAnswerOnTelegram() {
    const user = userEvent.setup();
    renderApp(`${customer}?log=call`);
    const dialog = await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
    await user.click(within(dialog).getByRole('radio', { name: 'جواب نداد' }));
    await user.click(within(dialog).getByRole('radio', { name: 'تلگرام' }));
    await user.click(screen.getByRole('button', { name: 'ثبت و ساختن پیگیری' }));
    return dialog;
  }

  it('Telegram opens with the draft and keeps the text on the clipboard', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    const dialog = await noAnswerOnTelegram();
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/t\.me\/\+98\d+\?text=/),
      '_blank',
      'noreferrer',
    );
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/\S/));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('with no mobile number opens nothing and copies the text', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    withCustomer({ phone: '', templates: TEMPLATES });
    await noAnswerOnTelegram();
    expect(open).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/\S/));
    expect(await toasts().findByText(/^شماره‌ی موبایل معتبری نیست/)).toBeInTheDocument();
  });
});
