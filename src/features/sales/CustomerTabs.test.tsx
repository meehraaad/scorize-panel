import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { instalmentPlan } from './plan';
import '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3;
const ERFAN = '/sales/customers/105';

describe('sales panel, customer sub-tabs, sale and offer', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  // Django names a payment after its invoices (PaymentViewSet).
  const WRITING = 'نگارش انگیزه‌نامه (ارشد)، نگارش رزومه';

  it('payments: confirms a receipt; a pending online payment has its link', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/payments`);
    const detail = await screen.findByRole('region', { name: WRITING });
    await user.click(within(detail).getByRole('button', { name: 'تأیید رسید' }));
    expect(await within(detail).findByText('پرداخت کامل شد.')).toBeInTheDocument();
    expect(await toasts().findByText('رسید تأیید شد.')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'پرداخت شماره‌ی ۴۹۰۲، بسته‌ی نمونه انگیزه‌نامه‌ها' }),
    );
    const pending = await screen.findByRole('region', { name: 'بسته‌ی نمونه انگیزه‌نامه‌ها' });
    expect(within(pending).getByRole('button', { name: 'کپی لینک پرداخت' })).toBeInTheDocument();
    await user.click(within(pending).getByRole('button', { name: 'ارسال فاکتور با پیامک' }));
    expect(within(pending).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('payments: declining a receipt asks first and takes an optional reason', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/payments`);
    const detail = await screen.findByRole('region', { name: WRITING });
    await user.click(within(detail).getByRole('button', { name: 'رد رسید' }));
    await user.type(within(detail).getByLabelText('علت رد (اختیاری)'), 'مبلغ یکی نیست');
    await user.click(within(detail).getByRole('button', { name: 'رد رسید' }));
    expect(await within(detail).findByText(/منتظر آپلود دوباره‌ی مشتری/)).toBeInTheDocument();
    expect(await toasts().findByText('رسید رد شد و برای مشتری پیامک رفت.')).toBeInTheDocument();
  });

  it('sells a product with a discount code and opens its invoice', async () => {
    const user = userEvent.setup();
    const router = renderApp(ERFAN);
    await user.click(await screen.findByText('فروش تازه'));
    await user.click(screen.getByRole('button', { name: /^فروش محصول/ }));
    const dialog = await screen.findByRole('dialog', { name: 'فروش محصول به عرفان ملکی' });
    await user.click(await within(dialog).findByRole('button', { name: 'نگارش' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /نگارش رزومه/ }));
    await user.type(within(dialog).getByLabelText('کد تخفیف'), 'scorize10');
    await user.click(within(dialog).getByRole('button', { name: 'اعمال' }));
    expect(await within(dialog).findByText('تخفیف: ۳۵۰٬۰۰۰ تومان')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ساختن پرداخت و ارسال فاکتور با پیامک' }));

    expect(await screen.findByRole('region', { name: 'نگارش رزومه' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${ERFAN}/payments`);
  });

  it('details: saves a section', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/info`);
    const personal = await screen.findByRole('region', { name: 'مشخصات' });
    const city = within(personal).getByLabelText('شهر محل زندگی');
    await user.clear(city);
    await user.type(city, 'تهران');
    await user.click(within(personal).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('ذخیره شد')).toBeInTheDocument();
  });

  it('purchases: one row per Django invoice, by kind', async () => {
    renderApp(`${ERFAN}/purchases`);
    const writing = await screen.findByRole('region', { name: 'نگارش' });
    expect(within(writing).getByText('نگارش رزومه')).toBeInTheDocument();
    const consultations = screen.getByRole('region', { name: 'مشاوره‌ها' });
    // The paid session and the failed attempt.
    expect(within(consultations).getAllByText('مشاوره‌ی اپلای ارشد')).toHaveLength(2);
    expect(within(consultations).getByText('پرداخت ناموفق')).toBeInTheDocument();
  });

  it('details: countries are found by name; an unknown one is reported', async () => {
    const user = userEvent.setup();
    renderApp(`${ERFAN}/info`);
    const goal = await screen.findByRole('region', { name: 'هدف و شرایط' });
    const countries = within(goal).getByLabelText('کشورهای مورد نظر');
    expect(countries).toHaveValue('هلند، آلمان');
    await user.clear(countries);
    await user.type(countries, 'هلند، Atlantis');
    await user.click(within(goal).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText(/«Atlantis» پیدا نشد/)).toBeInTheDocument();

    await user.clear(countries);
    await user.type(countries, 'هلند، canada');
    await user.click(within(goal).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('ذخیره شد')).toBeInTheDocument();
    expect(countries).toHaveValue('هلند، canada');
  });

  it('application file is read-only', async () => {
    renderApp(`${ERFAN}/apply`);
    expect(await screen.findByText(/فقط خواندنی/)).toBeInTheDocument();
    expect(screen.getByText('University of Twente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ذخیره' })).not.toBeInTheDocument();
  });

  it('offer: a big discount needs the manager; the draft goes to the manager', async () => {
    const user = userEvent.setup();
    const router = renderApp(`${ERFAN}/offer`);
    await screen.findByRole('heading', { name: 'پیشنهاد برای عرفان ملکی' });
    await user.selectOptions(screen.getByLabelText('تخفیف'), '15');
    expect(screen.getByText(/فقط با تأیید مدیر فروش ممکن است/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'فقط ارسال پیشنهاد به مشتری (پیامک و واتساپ)' }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: 'ارسال پیش‌نویس قرارداد برای تأیید مدیر' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'عرفان ملکی' });
    expect(router.state.location.pathname).toBe(ERFAN);
  });
});

describe('instalmentPlan', () => {
  it('takes 40% first (rounded to 100,000), the rest evenly, monthly from the start', () => {
    const plan = instalmentPlan(70_000_000, 3, '2026-11-22');
    expect(plan.map((item) => item.amount)).toEqual([28_000_000, 21_000_000, 21_000_000]);
    expect(plan[0]?.due).toBeNull();
    expect(new Date(plan[1]?.due ?? '').getMonth()).toBe(11);
    expect(instalmentPlan(5, 1, '2026-11-22')).toEqual([{ due: null, amount: 5 }]);
  });
});
