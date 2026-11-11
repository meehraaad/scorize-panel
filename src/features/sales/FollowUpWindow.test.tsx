import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import '@/test/server';

const NIMA = 3;

/* عرفان ملکی (mock 105) has an open follow-up. Today is Tuesday 5 Aban 1405, noon. */
describe('sales: the follow-up window on the customer page', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 12, 0), toFake: ['Date'] });
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the follow-up it moves, picks a time like the contact log, and saves', async () => {
    const user = userEvent.setup();
    renderApp('/sales/customers/105');
    await user.click(await screen.findByRole('button', { name: 'زمان دیگر' }));
    const dialog = await screen.findByRole('dialog', { name: 'زمان تازه برای پیگیری عرفان ملکی' });
    expect(within(dialog).getByText(/^پیگیری فعلی: /)).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'چه کاری (اختیاری)' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'فردا ۱۰:۰۰' }));
    await user.click(within(dialog).getByRole('button', { name: /^ثبت پیگیری · .*۱۰:۰۰$/ }));
    expect(await toasts().findByText(/^پیگیری به .*ساعت ۱۰:۰۰ رفت\.$/)).toBeInTheDocument();
  });

  it('"talked to them?" opens the contact log instead', async () => {
    const user = userEvent.setup();
    renderApp('/sales/customers/105');
    await user.click(await screen.findByRole('button', { name: 'زمان دیگر' }));
    const dialog = await screen.findByRole('dialog', { name: 'زمان تازه برای پیگیری عرفان ملکی' });
    await user.click(within(dialog).getByRole('button', { name: 'با او حرف زدید؟ ثبت ارتباط' }));
    expect(
      await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' }),
    ).toBeInTheDocument();
  });

  it('the in-person meeting window shows the follow-up above the week', async () => {
    const user = userEvent.setup();
    renderApp('/sales/customers/105');
    await user.click(await screen.findByRole('button', { name: /^جلسه حضوری با / }));
    const dialog = await screen.findByRole('dialog', { name: /^جلسه حضوری با / });
    expect(await within(dialog).findByText(/^پیگیری فعلی: /)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'با او حرف زدید؟ ثبت ارتباط' }),
    ).toBeInTheDocument();
  });
});
