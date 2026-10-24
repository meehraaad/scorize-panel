import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

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

const openPayment = async (path: string) => {
  loginAs(SARA);
  renderApp(path);
  await screen.findByRole('heading', { name: 'جزئیات پرداخت', level: 1 });
};

const installments = () => screen.getByRole('region', { name: 'قسط‌ها' });
/** One instalment row (0 = prepayment). */
const installment = (index: number) => {
  const row = within(installments()).getAllByRole('listitem')[index];
  if (!row) throw new Error(`No instalment row ${String(index)}`);
  return row;
};
const profile = () => screen.getByRole('region', { name: 'اطلاعات شما' });
const pdf = (name: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

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

    expect(await within(profile()).findByText('«کد پستی» ثبت شد.')).toBeInTheDocument();
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

  it('without a contract, shows a locked preview', async () => {
    loginAs(MARYAM);
    renderApp('/contract');
    // Canvas V7: the lock banner over a sample contract (more in src/app/locks.test.tsx).
    expect(await screen.findByRole('region', { name: 'این بخش قفل است' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رزرو مشاوره‌ی اپلای' })).toHaveAttribute(
      'href',
      '/consultation/',
    );
    expect(screen.getByText('نام شما', { selector: 'dd' }).closest('[inert]')).not.toBeNull();
  });
});

describe('payment page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('pays an instalment with a receipt', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openPayment('/payments/501');

    expect(screen.getByText('در حال پرداخت')).toBeInTheDocument();
    const items = screen.getByRole('region', { name: 'آیتم‌های خرید' });
    expect(within(items).getByText('۱. قسط ۲ قرارداد ۱۲۴۰')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'پرداخت آنلاین ۴۵٬۰۰۰٬۰۰۰ تومان' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'پرداخت با کارت‌به‌کارت و آپلود رسید' }));
    const form = screen.getByRole('region', { name: 'پرداخت با رسید' });
    expect(within(form).getByRole('button', { name: 'کپی شماره شبا' })).toBeInTheDocument();
    expect(within(items).getByText('پرداخت با رسید')).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'آپلود رسید' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('اول فایل رسید را انتخاب کنید.');

    const drop = within(form).getByLabelText('فایل رسید');
    await user.upload(drop, new File(['x'], 'receipt.docx', { type: 'application/msword' }));
    expect(drop).toHaveAccessibleDescription(/این نوع فایل پذیرفته نمی‌شود/);

    await user.upload(drop, pdf('receipt.pdf'));
    expect(within(form).getByText('receipt.pdf')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'آپلود رسید' }));

    expect(await screen.findByRole('heading', { name: 'رسید شما دریافت شد' })).toBeInTheDocument();
    expect(screen.getByText('منتظر بررسی فایل رسید')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'بازگشت' }));
    await screen.findByRole('heading', { name: 'قرارداد و پرداخت', level: 1 });
    const due = installment(2);
    expect(due).toHaveTextContent('رسید در حال بررسی');
    expect(within(due).getByRole('link', { name: 'جزئیات پرداخت' })).toHaveAttribute(
      'href',
      '/payments/501',
    );
  });

  it('opens the receipt form from the instalment button', async () => {
    await openPayment('/payments/501?method=receipt');
    expect(screen.getByRole('region', { name: 'پرداخت با رسید' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^پرداخت آنلاین/ })).toBeNull();
  });

  it('shows why a receipt was declined, with the form to send it again', async () => {
    await openPayment('/payments/504');
    expect(screen.getByRole('alert')).toHaveTextContent('رسید شما تأیید نشد');
    expect(screen.getByRole('alert')).toHaveTextContent('مبلغ رسید با فاکتور یکی نبود.');
    expect(screen.getByText('اعتبار استفاده‌شده')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'پرداخت با رسید' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بازگشت' })).toHaveAttribute('href', '/services');
  });

  it('shows a receipt in review without payment actions', async () => {
    await openPayment('/payments/503');
    expect(screen.getByRole('heading', { name: 'رسید شما دریافت شد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده‌ی رسید آپلودشده' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^پرداخت آنلاین/ })).toBeNull();
  });

  it('shows a paid invoice', async () => {
    await openPayment('/payments/505');
    expect(screen.getByRole('heading', { name: 'این پرداخت انجام شده است' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'پرداخت با رسید' })).toBeNull();
  });

  it('says so when the payment does not exist', async () => {
    await openPayment('/payments/999');
    expect(screen.getByText('این پرداخت پیدا نشد. شاید پیوند قدیمی است.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رفتن به قرارداد و پرداخت' })).toHaveAttribute(
      'href',
      '/contract',
    );
  });
});
