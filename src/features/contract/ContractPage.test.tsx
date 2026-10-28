import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const SARA = 1; // applicant: 4 instalments (2 paid, 1 due, 1 later), 2 empty details (src/mocks/applicant.ts)
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openContract = async () => {
  loginAs(SARA);
  renderApp('/contract');
  await screen.findByRole('heading', { name: 'قرارداد و پرداخت', level: 1 });
};

const installments = () => screen.getByRole('region', { name: 'قسط‌ها' });
/** One instalment row (0 = prepayment). */
const installment = (index: number) => {
  const row = within(installments()).getAllByRole('listitem')[index];
  if (!row) throw new Error(`No instalment row ${String(index)}`);
  return row;
};
const profile = () => screen.getByRole('region', { name: 'اطلاعات شما' });

describe('contract page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the contract, its instalments, details and documents', async () => {
    await openContract();
    const hero = screen.getByRole('region', { name: 'خلاصه‌ی قرارداد' });
    expect(within(hero).getByText('قرارداد شماره‌ی ۱۲۴۰ · سارا احمدی')).toBeInTheDocument();
    expect(within(hero).getByText('پذیرش، نگارش و ویزا')).toBeInTheDocument();
    expect(within(hero).getByText('۱۸۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(within(hero).getByText('فعال')).toBeInTheDocument();

    const waiting = screen.getByRole('region', { name: 'منتظر شما' });
    expect(waiting).toHaveTextContent('قسط ۲ از ۳');
    expect(within(waiting).getByRole('link', { name: 'پرداخت آنلاین' })).toHaveAttribute(
      'href',
      '/payments/501',
    );
    expect(waiting).toHaveTextContent('۲ مورد از اطلاعات شما خالی است');

    const rows = within(installments()).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('پیش‌پرداخت');
    expect(rows[0]).toHaveTextContent('پرداخت شده');
    expect(rows[2]).toHaveTextContent('قسط ۲');
    expect(rows[2]).toHaveTextContent('شرط پرداخت: بعد از پذیرش · پذیرش TU Munich ثبت شد');
    expect(rows[2]).toHaveTextContent('لازم‌الپرداخت');
    expect(within(installment(2)).getByRole('link', { name: 'پرداخت آنلاین' })).toHaveAttribute(
      'href',
      '/payments/501',
    );
    expect(within(installment(2)).getByRole('link', { name: 'آپلود رسید' })).toHaveAttribute(
      'href',
      '/payments/501?method=receipt',
    );
    // Not payable yet: no buttons.
    expect(within(installment(3)).queryByRole('link')).toBeNull();
    expect(within(installments()).getByText('پرداخت‌شده').nextSibling).toHaveTextContent(
      '۹۰٬۰۰۰٬۰۰۰ تومان',
    );

    expect(within(profile()).getByText('۲ مورد خالی')).toBeInTheDocument();
    // Set by the team or the account: no edit button.
    expect(within(profile()).queryByRole('button', { name: 'ویرایش ایمیل' })).toBeNull();
    expect(within(profile()).getByText('0912 000 0000')).toBeInTheDocument();

    const files = screen.getByRole('region', { name: 'اسناد قرارداد' });
    expect(within(files).getByRole('link', { name: 'دانلود اسکن قرارداد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ارسال تیکت' })).toHaveAttribute('href', '/tickets');
  });

  it('edits a detail in place, checks it and saves it', async () => {
    const user = userEvent.setup();
    await openContract();

    await user.click(within(profile()).getByRole('button', { name: 'افزودن کد پستی' }));
    const input = within(profile()).getByLabelText('کد پستی');
    expect(input).toHaveFocus();

    await user.type(input, '123');
    await user.click(within(profile()).getByRole('button', { name: 'ثبت' }));
    expect(input).toHaveAccessibleDescription('این شماره ۱۰ رقم است.');

    // Persian digits typed on a phone keyboard are fine.
    await user.clear(input);
    await user.type(input, '۸۱۷۴۶۷۳۱۱۱');
    await user.click(within(profile()).getByRole('button', { name: 'ثبت' }));

    expect(await toasts().findByText('«کد پستی» ثبت شد.')).toBeInTheDocument();
    expect(within(profile()).getByText('8174673111')).toBeInTheDocument();
    expect(within(profile()).getByText('۱ مورد خالی')).toBeInTheDocument();
    // Focus goes back to the row.
    expect(within(profile()).getByRole('button', { name: 'ویرایش کد پستی' })).toHaveFocus();
  });

  it('cancels an edit with Escape', async () => {
    const user = userEvent.setup();
    await openContract();
    await user.click(
      within(profile()).getByRole('button', { name: 'ویرایش نام یکی از افراد نزدیک' }),
    );
    await user.keyboard('{Escape}');
    expect(within(profile()).queryByLabelText('نام یکی از افراد نزدیک')).toBeNull();
    expect(
      within(profile()).getByRole('button', { name: 'ویرایش نام یکی از افراد نزدیک' }),
    ).toHaveFocus();
  });

  it('before the case starts, shows the prepayment to pay above the contract', async () => {
    loginAs(SARA);
    localStorage.setItem('scorize.mock.access', 'pending');
    renderApp('/contract');
    const start = await screen.findByRole('region', { name: 'شروع پرونده' });
    expect(start).toHaveTextContent('پیش‌پرداخت را بپردازید تا پرونده‌تان شروع شود.');
    expect(start).toHaveTextContent('پرداخت نشده');
    expect(within(start).getByText('۱٬۲۰۰٬۰۰۰')).toBeInTheDocument();
    const current = within(start)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('پیش‌پرداخت');
    expect(within(start).getByRole('link', { name: 'پرداخت آنلاین' })).toHaveAttribute(
      'href',
      '/payments/502',
    );
    expect(within(start).getByRole('link', { name: 'کارت‌به‌کارت و آپلود رسید' })).toHaveAttribute(
      'href',
      '/payments/502?method=receipt',
    );
    // The real instalments and details under it, not a locked preview.
    expect(installments().closest('[inert]')).toBeNull();
    expect(profile()).toBeInTheDocument();
  });

  it('without a contract, shows the two contracts as tickets', async () => {
    loginAs(MARYAM);
    renderApp('/contract');
    await screen.findByRole('heading', { name: 'تصمیم‌ها با شماست، کارها با ما.' });
    const turkey = screen.getByRole('article', { name: 'ترکیه' });
    expect(turkey).toHaveTextContent('رایگان');
    expect(within(turkey).getByRole('list', { name: 'مسیر شروع ترکیه' }).children).toHaveLength(3);
    const full = screen.getByRole('article', { name: 'قرارداد کامل' });
    expect(
      within(full).getByRole('list', { name: 'مسیر شروع قرارداد کامل' }).children,
    ).toHaveLength(4);
    expect(within(full).getByRole('link', { name: 'رزرو مشاوره' })).toHaveAttribute(
      'href',
      '/consultations/book',
    );
    expect(within(full).getByRole('button', { name: 'درخواست تماس' })).toBeInTheDocument();
    // Research interests can be saved before a contract.
    expect(
      await screen.findByRole('region', { name: 'دوست دارید روی چه موضوعی پژوهش کنید؟' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'سؤال‌های قبل از شروع' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'این بخش قفل است' })).toBeNull();
  });
});
