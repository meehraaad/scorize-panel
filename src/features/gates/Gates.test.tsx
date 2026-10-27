import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { MOCK_GATE_KEY } from '@/mocks/applicant';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// The gates without the to-do box: with it on, supervisor surveys are asked there instead
// (ActivityBox.test.tsx).
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, activities: false } };
});

const SARA = 1; // the gates knob only applies to her (src/mocks/applicant.ts)

const openWith = (gate: string, path = '/') => {
  localStorage.setItem('scorize.mock.session', String(SARA));
  localStorage.setItem(MOCK_GATE_KEY, gate);
  renderApp(path);
};

describe('gates before the applicant panel', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('asks for the terms, then the missing details, then opens the panel', async () => {
    const user = userEvent.setup();
    openWith('terms', '/applications');
    await screen.findByRole('heading', { name: /اول قوانین و شرایط را بخوانید/, level: 1 });
    expect(screen.getByRole('region', { name: 'متن قوانین و شرایط' })).toHaveTextContent(
      'موضوع قرارداد',
    );
    const accept = screen.getByRole('button', { name: 'پذیرش و ادامه' });
    expect(accept).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(accept);

    const step = await screen.findByRole('region', { name: 'چند اطلاعات ضروری را کامل کنید' });
    await user.type(within(step).getByLabelText('نام در پاسپورت (انگلیسی)'), 'سارا');
    await user.click(within(step).getByRole('button', { name: 'ثبت و ورود به پنل' }));
    expect(within(step).getByLabelText('نام در پاسپورت (انگلیسی)')).toHaveFocus();
    expect(within(step).getByLabelText('نام در پاسپورت (انگلیسی)')).toHaveAccessibleDescription(
      'با حروف انگلیسی، همان‌طور که در پاسپورت آمده است.',
    );
    await user.clear(within(step).getByLabelText('نام در پاسپورت (انگلیسی)'));
    await user.type(within(step).getByLabelText('نام در پاسپورت (انگلیسی)'), 'Sara Ahmadi');
    await user.type(within(step).getByLabelText('نام یکی از افراد نزدیک'), 'مریم احمدی');
    await user.type(within(step).getByLabelText('شماره‌ی موبایل فرد نزدیک'), '۰۹۱۳۰۰۰۰۰۰۰');
    await user.click(within(step).getByRole('button', { name: 'ثبت و ورود به پنل' }));

    // The page that was asked for.
    expect(
      await screen.findByRole('heading', { name: 'اپلای‌ها و نتایج', level: 1 }),
    ).toBeVisible();
  });

  it('takes the supervisor surveys one by one', async () => {
    const user = userEvent.setup();
    openWith('surveys');
    const first = await screen.findByRole('form', { name: /نظرسنجی ۱ از ۲/ });
    await user.click(within(first).getByRole('button', { name: 'ثبت و ادامه' }));
    expect(within(first).getByRole('alert')).toHaveTextContent('یکی از گزینه‌ها را انتخاب کنید.');
    await user.click(within(first).getByRole('radio', { name: 'راضی' }));
    await user.click(within(first).getByRole('button', { name: 'ثبت و ادامه' }));

    const second = await screen.findByRole('form', { name: /نظرسنجی ۲ از ۲/ });
    expect(second).toHaveTextContent('امیر کاظمی');
    await user.click(within(second).getByRole('radio', { name: 'خیلی راضی' }));
    await user.click(within(second).getByRole('button', { name: 'ثبت و ادامه' }));
    expect(await screen.findByRole('heading', { level: 1, name: /سارا/ })).toBeVisible();
  });

  it('shows a closed panel with the email logins', async () => {
    const user = userEvent.setup();
    openWith('inactive', '/documents');
    await screen.findByRole('heading', { name: 'قرارداد شما به پایان رسیده است', level: 1 });
    const emails = screen.getByRole('region', { name: 'اطلاعات ورود به ایمیل' });
    expect(within(emails).getByText('sara.ahmadi.apply@gmail.com')).toBeInTheDocument();
    expect(within(emails).queryByText('Sc0rize-1240!')).toBeNull();
    await user.click(within(emails).getByRole('button', { name: 'نمایش' }));
    expect(within(emails).getByText('Sc0rize-1240!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@scorize.com' })).toHaveAttribute(
      'href',
      'mailto:support@scorize.com',
    );
  });

  it('offers the NPS survey on the home page', async () => {
    const user = userEvent.setup();
    openWith('nps');
    const card = await screen.findByRole('region', { name: 'فقط چند ثانیه وقت بگذارید' });
    await user.click(within(card).getByRole('button', { name: 'ثبت فرم' }));
    expect(within(card).getByRole('alert')).toHaveTextContent('یک امتیاز انتخاب کنید.');
    await user.click(within(card).getByRole('radio', { name: '۹' }));
    await user.click(within(card).getByRole('button', { name: 'ثبت فرم' }));
    expect(await within(card).findByText(/۵٬۰۰۰ تومان به اعتبار شما اضافه شد/)).toBeVisible();
  });

  it('lets the NPS survey wait', async () => {
    const user = userEvent.setup();
    openWith('nps');
    const card = await screen.findByRole('region', { name: 'فقط چند ثانیه وقت بگذارید' });
    await user.click(within(card).getByRole('button', { name: 'بعداً' }));
    expect(screen.queryByRole('region', { name: 'فقط چند ثانیه وقت بگذارید' })).toBeNull();
  });
});
