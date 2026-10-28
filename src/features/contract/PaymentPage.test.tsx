import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

const SARA = 1; // invoices 501–510 (src/mocks/applicant.ts)
const MARYAM = 2; // no invoices

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

/** Opens a payment page as Sara, once its back link shows (every state has one). */
const openPayment = async (path: string) => {
  loginAs(SARA);
  const router = renderApp(path);
  await screen.findByRole('link', { name: 'بازگشت' });
  return router;
};

const pdf = (name: string) => new File([new Uint8Array(1024)], name, { type: 'application/pdf' });

/** The amount card's header: opens the code, the credit and the breakdown. */
const amountCard = () => screen.getByRole('button', { name: /^مبلغ پرداختی/ });

describe('payment page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('pays an instalment with a receipt', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openPayment('/payments/501');

    expect(screen.getByRole('heading', { name: 'تکمیل خرید', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^قسط ۲ قرارداد ۱۲۴۰/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پرداخت ۴۵٬۰۰۰٬۰۰۰ تومان' })).toBeInTheDocument();
    // An instalment never expires, and its price is the contract's: no code, no credit.
    expect(screen.queryByText(/دقیقه$/)).toBeNull();
    await user.click(amountCard());
    expect(screen.queryByRole('button', { name: 'افزودن کد' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'پرداخت با کارت‌به‌کارت و آپلود رسید' }));
    const form = screen.getByRole('region', { name: 'پرداخت با رسید' });
    expect(within(form).getByRole('button', { name: 'کپی شماره شبا' })).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'آپلود رسید' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('اول فایل رسید را انتخاب کنید.');
    await user.upload(within(form).getByLabelText('فایل رسید'), pdf('receipt.pdf'));
    await user.click(within(form).getByRole('button', { name: 'آپلود رسید' }));

    expect(await screen.findByRole('heading', { name: 'رسید شما دریافت شد' })).toBeInTheDocument();
    expect(screen.getByText('رسید آپلود شد')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'بازگشت' }));
    await screen.findByRole('heading', { name: 'قرارداد و پرداخت', level: 1 });
  });

  it('opens card transfer from the instalment button', async () => {
    await openPayment('/payments/501?method=receipt');
    expect(screen.getByRole('region', { name: 'پرداخت با رسید' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^پرداخت ۴۵/ })).toBeNull();
  });

  it('takes a discount code and the wallet credit before the bank', async () => {
    const user = userEvent.setup();
    await openPayment('/payments/502');

    // Two items folded into one line, the time left, and the amount with what changes it.
    expect(screen.getByRole('button', { name: /^۲ آیتم/ })).toHaveTextContent(
      'رزرو مشاوره و سفارش نگارش',
    );
    expect(screen.getByText('۱۸ دقیقه')).toBeInTheDocument();
    expect(amountCard()).toHaveTextContent('۱٬۲۰۵٬۰۰۰ تومان');

    await user.click(amountCard());
    await user.click(screen.getByRole('button', { name: 'افزودن کد' }));
    const field = screen.getByRole('textbox', { name: 'کد تخفیف' });
    await user.type(field, 'OLD');
    await user.click(screen.getByRole('button', { name: 'اعمال' }));
    expect(await screen.findByText('مهلت این کد تمام شده است.')).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'scorize10');
    await user.click(screen.getByRole('button', { name: 'اعمال' }));
    expect(await toasts().findByText('کد تخفیف اعمال شد.')).toBeInTheDocument();
    expect(screen.getByText('کد SCORIZE10')).toBeInTheDocument();
    expect(amountCard()).toHaveTextContent('۱٬۰۸۴٬۵۰۰ تومان');

    await user.click(screen.getByRole('switch', { name: /اعتبار کیف پول/ }));
    await waitFor(() => expect(amountCard()).toHaveTextContent('۱٬۰۳۴٬۵۰۰ تومان'));
    expect(screen.getByRole('button', { name: 'پرداخت ۱٬۰۳۴٬۵۰۰ تومان' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'حذف کد تخفیف' }));
    expect(await toasts().findByText('کد تخفیف حذف شد.')).toBeInTheDocument();
    expect(amountCard()).toHaveTextContent('۱٬۱۵۵٬۰۰۰ تومان');
  });

  it('asks to turn off the VPN when the bank would refuse the connection', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/applicant/v1/payments/:id/online/', () =>
        HttpResponse.json({ redirect_url: 'https://bank.example/pay/1', outside_iran: true }),
      ),
    );
    await openPayment('/payments/502');
    await user.click(screen.getByRole('button', { name: /^پرداخت ۱٬۲۰۵٬۰۰۰/ }));

    expect(
      await screen.findByRole('heading', { name: 'اول فیلترشکن را خاموش کنید' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'خاموش کردم، برو به درگاه' })).toHaveAttribute(
      'href',
      'https://bank.example/pay/1',
    );
    await user.click(screen.getByRole('button', { name: 'خارج از ایران هستم: کارت‌به‌کارت' }));
    expect(screen.getByRole('region', { name: 'پرداخت با رسید' })).toBeInTheDocument();
  });

  it('shows why a receipt was declined, with the form to send it again', async () => {
    await openPayment('/payments/504');
    expect(screen.getByRole('alert')).toHaveTextContent('رسید شما تأیید نشد');
    expect(screen.getByRole('alert')).toHaveTextContent('مبلغ رسید با فاکتور یکی نبود.');
    expect(screen.getByRole('link', { name: 'مشاهده‌ی رسید قبلی' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'پرداخت با رسید' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بازگشت' })).toHaveAttribute('href', '/payments');
  });

  it('shows a receipt in review without payment actions', async () => {
    await openPayment('/payments/503');
    expect(screen.getByRole('heading', { name: 'رسید شما دریافت شد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده‌ی رسید آپلودشده' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^پرداخت / })).toBeNull();
  });

  it('after paying, shows what was bought and where each item lives now', async () => {
    await openPayment('/payments/510');
    expect(screen.getByRole('heading', { name: 'پرداخت موفق بود' })).toBeInTheDocument();
    const next = screen.getByRole('region', { name: 'بعد از این' });
    expect(within(next).getByRole('link', { name: /رزرو مشاوره/ })).toHaveAttribute(
      'href',
      '/consultations/31',
    );
    expect(within(next).getByRole('link', { name: /سفارش نگارش/ })).toHaveAttribute(
      'href',
      '/writing/sop',
    );
    expect(screen.getByText(/اعتبار هدیه/)).toBeInTheDocument();
  });

  it('makes a new invoice for an expired one', async () => {
    const user = userEvent.setup();
    const router = await openPayment('/payments/507');
    expect(screen.getByRole('heading', { name: 'این فاکتور منقضی شده است' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^ساخت فاکتور تازه/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/payments/511'));
    expect(
      await screen.findByRole('heading', { name: 'تکمیل خرید', level: 1 }),
    ).toBeInTheDocument();
  });

  it('says a failed payment took nothing, and offers to pay again', async () => {
    await openPayment('/payments/508');
    expect(screen.getByRole('heading', { name: 'پرداخت انجام نشد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^دوباره پرداخت کنید/ })).toBeInTheDocument();
  });

  it('says so when the payment does not exist', async () => {
    loginAs(SARA);
    renderApp('/payments/999');
    expect(await screen.findByText('این پرداخت پیدا نشد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دیدن پرداخت‌های باز' })).toHaveAttribute(
      'href',
      '/payments',
    );
  });
});

describe('open payments', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lists what waits to be paid, newest first', async () => {
    loginAs(SARA);
    renderApp('/payments');
    const list = await screen.findByRole('region', { name: 'فاکتورها' });
    const rows = within(list).getAllByRole('link');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/payments/504',
      '/payments/503',
      '/payments/502',
      '/payments/501',
    ]);
    expect(rows[1]).toHaveTextContent('در دست بررسی');
    expect(rows[3]).toHaveTextContent('قسط قرارداد');
  });

  it('says so when nothing is open', async () => {
    loginAs(SARA);
    server.use(http.get('/api/applicant/v1/payments/', () => HttpResponse.json([])));
    renderApp('/payments');
    expect(await screen.findByText('پرداخت بازی ندارید.')).toBeInTheDocument();
  });
});

describe('an invoice by its public link', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows it signed out, with the way to sign in and pay', async () => {
    renderApp('/pay/TOKEN502');
    expect(await screen.findByRole('heading', { name: 'فاکتور پرداخت' })).toBeInTheDocument();
    expect(screen.getByText('در انتظار پرداخت')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ورود و پرداخت آنلاین' })).toHaveAttribute(
      'href',
      expect.stringContaining('TOKEN502'),
    );
  });

  it('sends its owner to the payment page', async () => {
    loginAs(SARA);
    const router = renderApp('/pay/TOKEN502?from=bank');
    await waitFor(() => expect(router.state.location.pathname).toBe('/payments/502'));
    expect(router.state.location.search).toBe('?from=bank');
  });

  it('tells another account the invoice is not theirs', async () => {
    loginAs(MARYAM);
    renderApp('/pay/TOKEN502');
    expect(await screen.findByText('این پرداخت پیدا نشد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'خروج و ورود با حساب دیگر' })).toBeInTheDocument();
  });
});

describe('campaign page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('registers into the open cart, and the item can come out again', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    const router = renderApp('/campaigns/apply-week');
    expect(await screen.findByRole('heading', { name: 'هفته‌ی اپلای' })).toBeInTheDocument();
    expect(screen.getByText('۱۲ جای خالی')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ثبت‌نام و پرداخت ۴۹۰٬۰۰۰ تومان' }));
    // Sara's cart (502) was open: the campaign joins it.
    await waitFor(() => expect(router.state.location.pathname).toBe('/payments/502'));
    const items = await screen.findByRole('button', { name: /^۳ آیتم/ });
    expect(items).toHaveTextContent('هفته‌ی اپلای');
    expect(amountCard()).toHaveTextContent('۱٬۶۹۵٬۰۰۰ تومان');

    await user.click(items);
    expect(screen.getByRole('link', { name: 'خرید دیگری به این سبد اضافه کنید' })).toHaveAttribute(
      'href',
      '/services',
    );
    await user.click(screen.getByRole('button', { name: 'حذف «هفته‌ی اپلای» از سبد' }));
    expect(await toasts().findByText('«هفته‌ی اپلای» از سبد حذف شد.')).toBeInTheDocument();
    expect(amountCard()).toHaveTextContent('۱٬۲۰۵٬۰۰۰ تومان');
    expect(screen.getByRole('button', { name: /^۲ آیتم/ })).toBeInTheDocument();
  });

  it('says so when the campaign is closed', async () => {
    loginAs(SARA);
    renderApp('/campaigns/gone');
    expect(
      await screen.findByText('این کمپین پیدا نشد یا ثبت‌نامش تمام شده است.'),
    ).toBeInTheDocument();
  });
});
