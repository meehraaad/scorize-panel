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
});
