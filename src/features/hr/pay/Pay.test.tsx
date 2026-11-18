import { screen, within } from '@testing-library/react';
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

  it('enters KPI results, works out the month and makes it final', async () => {
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

    await user.click(screen.getByRole('link', { name: 'حقوق ماه' }));
    await user.click(await screen.findByRole('button', { name: 'شروع حقوق این ماه' }));
    expect(await toasts().findByText('حقوق این ماه حساب شد.')).toBeInTheDocument();
    await user.click((await rowOf('علی رضایی')).getByRole('button', { name: 'فیش' }));
    const slip = await screen.findByRole('dialog', { name: 'فیش حقوقی علی رضایی' });
    // 32,000,000 + 20% × 87.5% bonus − 7% insurance − tax (10% to 30,000,000, then 15%)
    expect(within(slip).getByText('۵٬۶۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(within(slip).getByText('۱٬۳۴۵٬۲۰۰ تومان')).toBeInTheDocument();
    expect(within(slip).getByText('۳۳٬۶۲۲٬۸۰۰ تومان')).toBeInTheDocument();
    await user.type(within(slip).getByLabelText('کسر دیگر (مساعده…)'), '1000000');
    await user.click(within(slip).getByRole('button', { name: 'ذخیره‌ی فیش' }));
    expect(await within(slip).findByText('۳۲٬۶۲۲٬۸۰۰ تومان')).toBeInTheDocument();
    await user.click(within(slip).getByRole('button', { name: 'بستن' }));

    await user.click(screen.getByRole('button', { name: 'نهایی کن' }));
    await user.click(await screen.findByRole('button', { name: 'نهایی کن' }));
    expect(await toasts().findByText('حقوق این ماه نهایی شد.')).toBeInTheDocument();
    expect(await screen.findByText('نهایی')).toBeInTheDocument();
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

    await user.click(screen.getByRole('link', { name: 'نتیجه‌های KPI' }));
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

    await user.click(screen.getByRole('link', { name: 'نتیجه‌های KPI' }));
    const ali = await rowOf('علی رضایی');
    await user.type(ali.getByLabelText('تماس موفق'), '300');
    await user.type(ali.getByLabelText('قرارداد'), '8');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText('نتیجه‌ها ذخیره شد.')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'حقوق ماه' }));
    await user.click(await screen.findByRole('button', { name: 'شروع حقوق این ماه' }));
    await user.click((await rowOf('علی رضایی')).getByRole('button', { name: 'فیش' }));
    const slip = await screen.findByRole('dialog', { name: 'فیش حقوقی علی رضایی' });
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
});

