import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import '@/test/server';

const NIMA = 3;

/*
 * The mock office (src/mocks/sales.ts): open 9 to 18, two rooms, tomorrow (Wednesday) at 10 both
 * taken. Today is Tuesday 5 Aban 1405, noon.
 */
describe('sales: an in-person meeting at the office (S75)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 12, 0), toFake: ['Date'] });
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a full hour cannot be picked; a free one is booked, shown, then cancelled', async () => {
    const user = userEvent.setup();
    renderApp('/sales/customers/105');
    await user.click(await screen.findByRole('button', { name: /^جلسه حضوری با / }));
    const dialog = await screen.findByRole('dialog', { name: /^جلسه حضوری با / });
    const calendar = await within(dialog).findByRole('region', { name: 'ساعت‌های جلسه حضوری' });

    // Tomorrow 10:00: every room is taken, on the seller's own week.
    const full = await within(calendar).findByRole('button', {
      name: /۱۰:۰۰، در این ساعت همه‌ی اتاق‌ها پر است/,
    });
    await user.click(full);
    expect(await toasts().findByText('در این ساعت همه‌ی اتاق‌ها پر است.')).toBeInTheDocument();

    // A free spot on Wednesday (the week's fifth day); the grid starts at 9, an hour is 44px: 14:00.
    fireEvent.click(within(calendar).getAllByTestId('schedule-slot')[4] as HTMLElement, {
      clientY: 220,
    });
    expect(
      await within(calendar).findByRole('button', { name: /^چهارشنبه.*۱۴:۰۰/ }),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('یادداشت جلسه'), 'مدارک را بیاورد');
    await user.click(within(dialog).getByRole('button', { name: 'ثبت جلسه' }));
    expect(
      await toasts().findByText(/^جلسه حضوری برای چهارشنبه.*ساعت ۱۴:۰۰ ثبت شد/),
    ).toBeInTheDocument();

    // Opened again: the meeting ahead, with cancel.
    await user.click(screen.getByRole('button', { name: /^جلسه حضوری با / }));
    const again = await screen.findByRole('dialog', { name: /^جلسه حضوری با / });
    expect(await within(again).findByText('جلسه حضوری در پیش')).toBeInTheDocument();
    expect(within(again).getByText(/اتاق A/)).toBeInTheDocument();
    await user.click(within(again).getByRole('button', { name: 'لغو جلسه' }));
    await user.click(
      within(within(again).getByRole('group')).getByRole('button', { name: 'لغو جلسه' }),
    );
    expect(await toasts().findByText('جلسه لغو شد.')).toBeInTheDocument();
  });

  it('asks for a time first, and for a colleague when asking one', async () => {
    const user = userEvent.setup();
    renderApp('/sales/customers/105');
    await user.click(await screen.findByRole('button', { name: /^جلسه حضوری با / }));
    const dialog = await screen.findByRole('dialog', { name: /^جلسه حضوری با / });
    await within(dialog).findByRole('region', { name: 'ساعت‌های جلسه حضوری' });
    await user.click(within(dialog).getByRole('switch', { name: /درخواست حضور از همکار/ }));
    await user.click(within(dialog).getByRole('button', { name: 'ثبت جلسه' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'یک ساعت آزاد را روی تقویم انتخاب کنید.',
    );
    expect(await within(dialog).findByText('همکاری را انتخاب کنید.')).toBeInTheDocument();
  });
});
