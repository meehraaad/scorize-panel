import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import '@/test/server';

const NIMA = 3; // seller (mock user in src/mocks/handlers.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

/*
 * The mock's consultations (src/mocks/sales.ts), from Tuesday 5 Aban 1405 (27 Oct 2026) noon:
 * yesterday two not logged (online; in person), today one logged, in 20 minutes one in person,
 * in 5 hours one online, in 2 days one in person. Odd ids filled the tablet form.
 */
describe('sales: my consultations on a week calendar', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 12, 0), toFake: ['Date'] });
    localStorage.clear();
    await i18n.changeLanguage('fa');
    loginAs(NIMA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const open = async () => {
    renderApp('/sales/leads/consultations');
    return screen.findByRole('region', { name: 'مشاوره‌های من' });
  };

  it('shows the week: state, how it is held, the tablet form', async () => {
    const calendar = await open();
    expect(screen.getByRole('heading', { name: '۲ تا ۸ آبان ۱۴۰۵' })).toBeInTheDocument();
    const blocks = within(calendar).getAllByRole('button', { pressed: false });
    const label = (pattern: RegExp) =>
      blocks.filter((block) => pattern.test(block.getAttribute('aria-label') ?? ''));
    expect(label(/ثبت نشده/)).toHaveLength(2);
    expect(label(/برگزار و ثبت شد/)).toHaveLength(1);
    expect(label(/تا ۳۰ دقیقه‌ی دیگر/)).toHaveLength(1);
    expect(label(/حضوری/)).toHaveLength(3);
    expect(label(/فرم تبلت را هنوز پر نکرده/)).toHaveLength(3);
  });

  it('in person, soon: waiting for the customer, then marked arrived', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(within(calendar).getByRole('button', { name: /تا ۳۰ دقیقه‌ی دیگر/ }));
    const card = within(calendar).getByRole('dialog');
    expect(within(card).getByText('منتظر مراجعه‌ی مشتری')).toBeInTheDocument();
    expect(within(card).getByText('فرم تبلت را هنوز پر نکرده')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'فرستادن لینک فرم' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/'),
    );
    await user.click(within(card).getByRole('button', { name: 'مشتری رسید' }));
    expect(await toasts().findByText(/ثبت شد\.$/)).toBeInTheDocument();
    expect(await within(card).findAllByText('مشتری رسیده')).not.toHaveLength(0);
  });

  it('online, later today: a reminder; not logged: the session log', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(within(calendar).getByRole('button', { name: /آنلاین، پیش رو/ }));
    let card = within(calendar).getByRole('dialog');
    expect(within(card).getByRole('link', { name: 'یادآوری در واتساپ' })).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: 'فرستادن لینک فرم' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'بستن' }));

    await user.click(
      within(calendar).getAllByRole('button', { name: /ثبت نشده/ })[0] as HTMLElement,
    );
    card = within(calendar).getByRole('dialog');
    await user.click(within(card).getByRole('button', { name: /^ثبت جلسه: / }));
    expect(await screen.findByRole('radio', { name: 'جلسه‌ی مشاوره' })).toBeChecked();
  });

  it('only the unlogged, and a type hidden', async () => {
    const user = userEvent.setup();
    const calendar = await open();
    await user.click(screen.getByRole('button', { name: '۲ جلسه‌ی ثبت‌نشده' }));
    expect(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه' })).toBeChecked();
    expect(within(calendar).getAllByRole('button', { pressed: false })).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: 'فقط بدون ثبت جلسه' }));
    await user.click(screen.getByRole('checkbox', { name: /مشاوره‌ی ویزای تحصیلی/ }));
    expect(within(calendar).queryAllByRole('button', { name: /ویزای تحصیلی/ })).toHaveLength(0);
  });

  it('pages weeks and switches to the list', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'هفته‌ی بعد' }));
    expect(await screen.findByRole('heading', { name: '۹ تا ۱۵ آبان ۱۴۰۵' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'فهرست' }));
    expect(await screen.findByRole('group', { name: 'بازه' })).toBeInTheDocument();
  });
});
