import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import i18n from '@/lib/i18n';
import { SALES_API } from '@/lib/sales/api';
import type { VisitSlots } from './api/visits';
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

  describe('S79: a meeting at the office is the follow-up there', () => {
    const flags = ON_SERVER as { visitFollowUp: boolean };
    beforeEach(() => {
      flags.visitFollowUp = true;
    });
    afterEach(() => {
      flags.visitFollowUp = false;
    });

    /** A free hour two days on, booked as the seller would from the meeting window. */
    async function bookMeeting() {
      const day = new Date(2026, 9, 29);
      const value = `2026-10-${String(day.getDate())}`;
      const { slots } = await api<VisitSlots>(
        `${SALES_API}/visits/slots/?${new URLSearchParams({ from: value, to: value }).toString()}`,
      );
      const free = slots.find((slot) => slot.left > 0);
      if (!free) throw new Error('no free hour in the mock');
      await api(`${SALES_API}/customers/105/visits/`, {
        method: 'POST',
        body: { starts_at: free.at },
      });
    }

    it('the follow-up window offers a call or a meeting', async () => {
      const user = userEvent.setup();
      renderApp('/sales/customers/105');
      await user.click(await screen.findByRole('button', { name: 'زمان دیگر' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'زمان تازه برای پیگیری عرفان ملکی',
      });
      expect(within(dialog).getByRole('radio', { name: 'تماس' })).toBeChecked();
      await user.click(within(dialog).getByRole('radio', { name: 'جلسه حضوری در دفتر' }));
      expect(await within(dialog).findByText(/^روی یک ساعت بزنید/)).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'ثبت جلسه' })).toBeInTheDocument();
      await user.click(within(dialog).getByRole('radio', { name: 'تماس' }));
      expect(
        within(dialog).getByRole('textbox', { name: 'چه کاری (اختیاری)' }),
      ).toBeInTheDocument();
    });

    it('with a meeting ahead the contact log keeps it as the next step', async () => {
      await bookMeeting();
      const user = userEvent.setup();
      renderApp('/sales/customers/105');
      await user.click(await screen.findByRole('button', { name: 'زمان دیگر' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'زمان تازه برای پیگیری عرفان ملکی',
      });
      await user.click(within(dialog).getByRole('button', { name: 'با او حرف زدید؟ ثبت ارتباط' }));
      const log = await screen.findByRole('dialog', { name: 'ثبت ارتباط با عرفان ملکی' });
      expect(await within(log).findByText(/^قدم بعد: جلسه حضوری /)).toBeInTheDocument();
      expect(within(log).queryByRole('button', { name: 'دعوت به جلسه حضوری' })).toBeNull();
    });

    it('moving that follow-up is refused: the meeting is changed instead', async () => {
      await bookMeeting();
      const user = userEvent.setup();
      renderApp('/sales/customers/105');
      await user.click(await screen.findByRole('button', { name: 'زمان دیگر' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'زمان تازه برای پیگیری عرفان ملکی',
      });
      await user.click(within(dialog).getByRole('radio', { name: 'فردا ۱۰:۰۰' }));
      await user.click(within(dialog).getByRole('button', { name: /^ثبت پیگیری · .*۱۰:۰۰$/ }));
      expect(await toasts().findByText(/^پیگیری این مشتری جلسه حضوری اوست\./)).toBeInTheDocument();
    });
  });
});
