import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const AMIR = 6; // holds can_manage_support_staff (src/mocks/hr.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

/** The list item (a person's card or slip row) holding `name`'s link. */
const rowOf = async (name: string) => {
  const link = await screen.findByRole('link', { name: new RegExp(name) });
  const item = link.closest('li');
  if (!item) throw new Error(`no row for ${name}`);
  return within(item);
};

describe('HR pay and KPIs', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('enters KPI results one by one', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/pay/results');
    const ali = await rowOf('علی رضایی');
    await user.type(ali.getByLabelText('تماس موفق'), '300');
    await user.type(ali.getByLabelText('قرارداد'), '4');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('نتیجه‌ها ذخیره شد.')).toBeInTheDocument();
    // (100% × 3 + 50% × 1) / 4
    expect(await ali.findByText('امتیاز KPI ۸۷٫۵٪')).toBeInTheDocument();
  });

  it('adds a KPI to a position', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/pay/kpis');
    const sales = await screen.findByRole('region', { name: 'کارشناس فروش' });
    await user.click(within(sales).getByRole('button', { name: 'شاخص' }));
    const dialog = await screen.findByRole('dialog', { name: 'شاخص تازه' });
    await user.type(within(dialog).getByLabelText('نام شاخص'), 'رضایت مشتری');
    await user.type(within(dialog).getByLabelText('هدف'), '90');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('شاخص ذخیره شد.')).toBeInTheDocument();
    expect(await within(sales).findByText('رضایت مشتری')).toBeInTheDocument();
  });

  it('measures a KPI for everyone and changes a value only with a reason', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/pay/kpis');
    await user.click(await screen.findByRole('button', { name: 'شاخص تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'شاخص تازه' });
    await user.selectOptions(
      within(dialog).getByLabelText('چه چیزی اندازه گرفته شود'),
      'tasks.on_time_percent',
    );
    expect(within(dialog).getByLabelText('نام شاخص')).toHaveValue('درصد کارهای انجام‌شده سر وقت');
    await user.selectOptions(within(dialog).getByLabelText('برای چه کسی'), 'all');
    await user.type(within(dialog).getByLabelText('هدف'), '90');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('شاخص ذخیره شد.')).toBeInTheDocument();
    const everyone = await screen.findByRole('region', { name: 'همه‌ی کارکنان' });
    expect(within(everyone).getByText('آزمایشی')).toBeInTheDocument();

    // The detailed values page, from the settings
    await user.click(screen.getByRole('button', { name: 'تنظیمات حقوق' }));
    const settings = await screen.findByRole('dialog', { name: 'تنظیمات حقوق' });
    await user.click(await within(settings).findByText('بیشتر'));
    await user.click(within(settings).getByRole('link', { name: /^نتیجه‌های KPI/ }));
    await user.click(await screen.findByRole('button', { name: 'اندازه‌گیری دوباره' }));
    expect(await toasts().findByText('عددهای خودکار دوباره اندازه گرفته شد.')).toBeInTheDocument();
    const ali = await rowOf('علی رضایی');
    const field = await ali.findByLabelText('درصد کارهای انجام‌شده سر وقت');
    expect(field).toHaveValue('80');
    await user.clear(field);
    await user.type(field, '85');
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeDisabled();
    await user.type(ali.getByLabelText('دلیل تغییر'), 'یک کار را مشتری لغو کرد');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('نتیجه‌ها ذخیره شد.')).toBeInTheDocument();
    expect(await ali.findByText('اصلاح‌شده')).toBeInTheDocument();
    expect(ali.getByText('دلیل اصلاح: یک کار را مشتری لغو کرد')).toBeInTheDocument();
  });

  it('adds a reward rule that shows on the slip', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/pay/rules');
    await user.click(await screen.findByRole('button', { name: 'قانون تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'قانون تازه' });
    await user.type(within(dialog).getByLabelText('نام قانون'), 'پاداش امتیاز');
    await user.type(within(dialog).getByLabelText('از'), '80');
    await user.type(within(dialog).getByLabelText('مبلغ'), '1000000');
    await user.click(within(dialog).getByRole('switch', { name: /روی فیش دیده می‌شود/ }));
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('قانون ذخیره شد.')).toBeInTheDocument();
    const rewards = await screen.findByRole('region', { name: 'پاداش‌ها' });
    expect(within(rewards).getByText('پاداش امتیاز')).toBeInTheDocument();

    // The detailed values page, from the settings
    await user.click(screen.getByRole('button', { name: 'تنظیمات حقوق' }));
    const settings = await screen.findByRole('dialog', { name: 'تنظیمات حقوق' });
    await user.click(await within(settings).findByText('بیشتر'));
    await user.click(within(settings).getByRole('link', { name: /^نتیجه‌های KPI/ }));
    const ali = await rowOf('علی رضایی');
    await user.type(ali.getByLabelText('تماس موفق'), '300');
    await user.type(ali.getByLabelText('قرارداد'), '8');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('نتیجه‌ها ذخیره شد.')).toBeInTheDocument();

    // This month on «ماه» (it opens on last month): its pay is worked out as a draft.
    await user.click(screen.getByRole('link', { name: 'ماه' }));
    const hero = () => within(screen.getByRole('region', { name: 'ماه حقوق' }));
    await screen.findByRole('region', { name: 'ماه حقوق' });
    const last = hero().getByRole('heading', { level: 2 }).textContent;
    await user.click(await screen.findByRole('button', { name: 'ماه بعد' }));
    await waitFor(() => {
      expect(hero().getByRole('heading', { level: 2 }).textContent).not.toBe(last);
    });
    await user.click(await screen.findByRole('button', { name: 'فیش علی رضایی' }));
    const slip = await screen.findByRole('dialog', { name: 'علی رضایی' });
    expect(within(slip).getByText('پاداش امتیاز (100)')).toBeInTheDocument();
    expect(within(slip).getByText('۱٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
  });

  it('closes the month, takes an objection on «من» and blocks the final pay until answered', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    const router = renderApp('/hr/pay/results');
    const ali = await rowOf('علی رضایی');
    await user.type(ali.getByLabelText('تماس موفق'), '150');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('نتیجه‌ها ذخیره شد.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'بستن ماه برای بررسی' }));
    const dialog = await screen.findByRole('dialog', { name: 'بستن ماه برای بررسی' });
    await user.click(within(dialog).getByRole('button', { name: 'بستن ماه برای بررسی' }));
    expect(
      await toasts().findByText('ماه بسته شد و همه می‌توانند عددهایشان را ببینند.'),
    ).toBeInTheDocument();

    // The person (the mocks show «من» as Ali) objects to a value.
    await user.click(screen.getByRole('button', { name: 'حساب کاربری' }));
    await user.click(await screen.findByRole('link', { name: 'امتیاز و پرداخت من' }));
    await user.type(await screen.findByLabelText('رمز عبور'), 'password123');
    await user.click(screen.getByRole('button', { name: 'باز کردن' }));
    const calls = await screen.findByText('تماس موفق');
    const kpi = within(calls.closest('li') as HTMLElement);
    await user.click(kpi.getByRole('button', { name: 'به این عدد اعتراض دارم' }));
    await user.type(kpi.getByLabelText('چرا این عدد درست نیست؟'), 'دو روز مرخصی بودم');
    await user.click(kpi.getByRole('button', { name: 'فرستادن اعتراض' }));
    expect(await toasts().findByText('اعتراض شما فرستاده شد.')).toBeInTheDocument();
    expect(await kpi.findByText('منتظر جواب')).toBeInTheDocument();

    // HR answers it with a new value.
    await router.navigate('/hr/pay/results');
    const objections = await screen.findByRole('region', { name: /اعتراض‌ها/ });
    await user.type(within(objections).getByLabelText('جواب شما'), 'درست است');
    await user.type(within(objections).getByLabelText('عدد درست (اختیاری)'), '180');
    await user.click(within(objections).getByRole('button', { name: 'پذیرفتن' }));
    expect(await toasts().findByText('اعتراض پذیرفته شد.')).toBeInTheDocument();
    expect(await within(objections).findByText('پذیرفته شد')).toBeInTheDocument();
  });

  it('shows a seller their sales month and call ratings on «من»', async () => {
    const user = userEvent.setup();
    loginAs(3); // Nima, a seller (src/mocks/handlers.ts)
    const router = renderApp('/me');
    const tabs = await screen.findByRole('navigation', { name: 'بخش‌های من' });
    await user.click(within(tabs).getByRole('link', { name: 'عملکرد فروش' }));
    expect(await screen.findByRole('button', { name: 'باز کردن ماه من' })).toBeInTheDocument();
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me/sales');

    const monthTabs = screen.getByRole('navigation', { name: 'بخش‌های من' });
    await user.click(within(monthTabs).getByRole('link', { name: 'امتیاز تماس‌های من' }));
    expect(await screen.findByRole('heading', { name: 'امتیاز تماس‌های من' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me/call-ratings');
  });

  it.each(['/me/sales', '/me/call-ratings'])(
    'sends a non-seller from %s back to their pay',
    async (path) => {
      loginAs(2); // Maryam: staff, not a seller
      renderApp(path);
      expect(
        await screen.findByRole('heading', { name: 'امتیاز و پرداخت من' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'بخش‌های من' })).not.toBeInTheDocument();
    },
  );

  it('opens my pay only with my password', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/me');
    await user.type(await screen.findByLabelText('رمز عبور'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'باز کردن' }));
    expect(await screen.findByText('رمز عبور درست نیست.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('رمز عبور'));
    await user.type(screen.getByLabelText('رمز عبور'), 'password123');
    await user.click(screen.getByRole('button', { name: 'باز کردن' }));
    expect(await screen.findByText('تماس موفق')).toBeInTheDocument();
  });

  it("sets a group's score plan with − and +, and sees last month's effect", async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/pay/plans');
    await user.click(await screen.findByRole('link', { name: /^کارشناس فروش/ }));
    expect(
      await screen.findByRole('heading', { name: 'قاعده‌ی کارشناس فروش' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'بیشتر کردن هدف تماس موفق' }));
    expect(screen.getByLabelText('هدف تماس موفق')).toHaveValue('۳۵۰');
    const importance = screen.getByRole('group', { name: 'اهمیت قرارداد' });
    await user.click(within(importance).getByRole('button', { name: 'زیاد' }));
    expect(within(importance).getByRole('button', { name: 'زیاد' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'بیشتر کردن درصد پاداش' }));
    await user.click(screen.getByRole('switch', { name: /پورسانت فروش/ }));
    await user.click(screen.getByRole('switch', { name: /پاداش تیمی/ }));
    expect(screen.getByRole('button', { name: 'بیشتر کردن حد پاداش تیمی' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی قاعده' }));
    expect(await toasts().findByText('قاعده ذخیره شد.')).toBeInTheDocument();
    const preview = screen.getByRole('complementary', { name: 'اگر این قاعده ماه پیش بود' });
    expect(await within(preview).findByText('علی رضایی')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'همه‌ی قاعده‌ها' }));
    expect(await screen.findByText(/پورسانت · پاداش تیمی/)).toBeInTheDocument();
  });

  it('checks last month, shows it to staff, adds overtime, pays it and corrects it next month', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/pay');
    const missing = await screen.findByRole('region', { name: 'این عددها را سیستم نمی‌داند' });
    expect(screen.getByRole('button', { name: 'نشان دادن به کارکنان' })).toBeDisabled();
    for (const field of within(missing).getAllByRole('textbox')) await user.type(field, '5');
    await user.click(within(missing).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('نتیجه‌ها ذخیره شد.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'نشان دادن به کارکنان' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'نشان دادن به کارکنان' }));
    expect(await toasts().findByText('ماه به کارکنان نشان داده شد.')).toBeInTheDocument();
    expect(await screen.findByText(/نفر فیششان را دیده‌اند/)).toBeInTheDocument();

    // A line added by hand to Ali's slip
    await user.click(screen.getByRole('button', { name: 'فیش علی رضایی' }));
    const slip = await screen.findByRole('dialog', { name: 'علی رضایی' });
    await user.click(within(slip).getByRole('button', { name: 'افزودن سطر' }));
    await user.type(within(slip).getByLabelText('مبلغ (تومان)'), '1000000');
    await user.type(within(slip).getByLabelText('توضیح'), '۱۲ ساعت');
    await user.click(within(slip).getByRole('button', { name: 'افزودن به فیش' }));
    expect(await toasts().findByText('سطر به فیش اضافه شد.')).toBeInTheDocument();
    expect(await within(slip).findByText('اضافه‌کار (۱۲ ساعت)')).toBeInTheDocument();
    await user.click(within(slip).getByRole('button', { name: 'بستن' }));

    await user.click(screen.getByRole('button', { name: 'نهایی و پرداخت' }));
    await user.click(await screen.findByRole('button', { name: 'بله، نهایی کن' }));
    expect(await toasts().findByText('حقوق این ماه نهایی شد.')).toBeInTheDocument();
    expect(await screen.findByText('پرداخت‌شده')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'فایل حسابداری' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/api\/hr\/v1\/payroll\/\d+\/export\/$/),
    );

    // A paid month is corrected on next month's slip
    await user.click(screen.getByRole('button', { name: 'فیش علی رضایی' }));
    const paid = await screen.findByRole('dialog', { name: 'علی رضایی' });
    expect(within(paid).queryByRole('button', { name: 'افزودن سطر' })).not.toBeInTheDocument();
    await user.click(within(paid).getByRole('button', { name: 'اصلاح در ماه بعد' }));
    await user.type(within(paid).getByLabelText('مبلغ (تومان)'), '200000');
    await user.type(within(paid).getByLabelText('توضیح'), 'اضافه‌کار جامانده');
    await user.click(within(paid).getByRole('button', { name: 'ثبت اصلاح' }));
    expect(await toasts().findByText('اصلاح به فیش ماه بعد اضافه شد.')).toBeInTheDocument();
  });
});
