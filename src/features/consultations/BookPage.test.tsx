import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { CALENDAR_TYPES, bookingsSent, setCalendarTypes } from '@/mocks/journey';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const MARYAM = 2; // no bookings

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('booking a consultation', () => {
  beforeEach(async () => {
    // Monday 4 Aban 1405 (26 Oct 2026); the mock's times start tomorrow, 10:00 Tehran = 06:30 UTC.
    vi.useFakeTimers({ now: new Date('2026-10-26T09:00:00Z'), toFake: ['Date'] });
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('online first, its most booked topic, then a time on the week', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    const router = renderApp('/consultations/book');
    const how = await screen.findByRole('group', { name: 'جلسه چطور برگزار شود؟' });
    expect(within(how).getByRole('radio', { name: /^آنلاین/ })).toBeChecked();
    const topics = screen.getByRole('group', { name: 'موضوع جلسه‌ی آنلاین' });
    expect(within(topics).getByRole('radio', { name: /مشاوره‌ی اپلای/ })).toBeChecked();
    expect(within(topics).getByText('پرطرفدار')).toBeInTheDocument();
    expect(within(topics).queryByRole('radio', { name: /اپلای حضوری/ })).toBeNull();

    const calendar = screen.getByRole('region', { name: 'زمان‌های مشاوره‌ی اپلای' });
    expect(within(calendar).getByRole('heading', { name: '۲ تا ۸ آبان ۱۴۰۵' })).toBeInTheDocument();
    // Each Jalali day with its Gregorian date under it.
    expect(within(calendar).getByText('27 Oct')).toBeInTheDocument();
    const tuesday = within(calendar).getByRole('group', { name: 'سه‌شنبه ۵ آبان' });
    // Free, one seat left, full.
    expect(within(tuesday).getByRole('button', { name: /۰۶:۳۰ تا ۰۶:۵۰$/ })).toBeEnabled();
    expect(within(tuesday).getByRole('button', { name: /۰۶:۵۰ تا ۰۷:۱۰، ۱ جا$/ })).toBeEnabled();
    expect(within(tuesday).getByRole('button', { name: /۰۷:۱۰ تا ۰۷:۳۰، پر شد$/ })).toBeDisabled();

    await user.click(within(tuesday).getByRole('button', { name: /۰۶:۵۰ تا ۰۷:۱۰/ }));
    const card = screen.getByRole('dialog', { name: 'زمان انتخابی برای مشاوره‌ی اپلای' });
    expect(within(card).getByText('سه‌شنبه ۵ آبان · ۰۶:۵۰ تا ۰۷:۱۰')).toBeInTheDocument();
    expect(within(card).getByText(/27 Oct 2026/)).toBeInTheDocument();
    expect(within(card).getByText('۵۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(within(card).getByText('فقط یک جای خالی مانده')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'رزرو و پرداخت' }));
    // On to its purchase page: code, credit and how to pay.
    await waitFor(() => expect(router.state.location.pathname).toBe('/payments/77'));
    expect(bookingsSent).toEqual([{ type: 3, starts_at: '2026-10-27T06:50:00.000Z' }]);
  });

  it('in person shows its own topics, and "another time" closes the card', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/consultations/book?mode=in_person');
    const topics = await screen.findByRole('group', { name: 'موضوع جلسه‌ی حضوری' });
    const office = within(topics).getByRole('radio', { name: /اپلای حضوری/ });
    expect(office).toBeChecked();
    expect(within(topics).getByText('۱٬۵۰۰٬۰۰۰ تومان')).toBeInTheDocument(); // before the discount

    const calendar = screen.getByRole('region', { name: 'زمان‌های اپلای حضوری' });
    await user.click(
      within(calendar).getAllByRole('button', { name: /۰۶:۳۰ تا ۰۷:۳۰$/ })[0] as HTMLElement,
    );
    const card = screen.getByRole('dialog', { name: 'زمان انتخابی برای اپلای حضوری' });
    expect(within(card).getByText('حضوری در دفتر اسکورایز · ۶۰ دقیقه')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'زمان دیگر' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('radio', { name: /^آنلاین/ }));
    expect(screen.getByRole('group', { name: 'موضوع جلسه‌ی آنلاین' })).toBeInTheDocument();
  });

  it('pages weeks, and a week with nothing free points on', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/consultations/book');
    const calendar = await screen.findByRole('region', { name: 'زمان‌های مشاوره‌ی اپلای' });
    expect(within(calendar).getByRole('button', { name: 'هفته‌ی قبل' })).toBeDisabled();
    await user.click(within(calendar).getByRole('button', { name: 'هفته‌ی بعد' }));
    expect(
      within(calendar).getByRole('heading', { name: '۹ تا ۱۵ آبان ۱۴۰۵' }),
    ).toBeInTheDocument();
    await user.click(within(calendar).getByRole('button', { name: 'این هفته' }));
    expect(within(calendar).getByRole('heading', { name: '۲ تا ۸ آبان ۱۴۰۵' })).toBeInTheDocument();
  });

  it('says when nothing can be booked', async () => {
    loginAs(MARYAM);
    setCalendarTypes(MARYAM, []);
    renderApp('/consultations/book');
    expect(await screen.findByText('فعلاً مشاوره‌ای برای رزرو نیست')).toBeInTheDocument();
    expect(CALENDAR_TYPES.length).toBeGreaterThan(0);
  });
});
