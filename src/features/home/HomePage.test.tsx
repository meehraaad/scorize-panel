import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ON_SERVER, type ServerFeature } from '@/lib/applicant/onServer';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import '@/test/server';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const SARA = 1; // applicant with a contract (mock case in src/mocks/handlers.ts)
const MARYAM = 2; // staff, no applicant file of her own

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openHome = async () => {
  loginAs(SARA);
  renderApp('/');
  await screen.findByRole('heading', { name: 'سلام سارا، پرونده‌ی شما در مرحله‌ی اپلای است' });
};

const todos = () => screen.getByRole('region', { name: 'کارهای منتظر شما' });

describe('applicant home', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the case: card, stages, tasks, ticket, deadlines and summary', async () => {
    await openHome();
    const card = screen.getByRole('region', { name: 'کارت پرونده' });
    expect(within(card).getByText('کانادا و آلمان')).toBeInTheDocument();
    expect(within(card).getByText('قرارداد پذیرش، نگارش و ویزا')).toBeInTheDocument();
    const current = within(card)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('اپلای');

    // Five tasks plus the recommendation and professor-list forms to fill in.
    expect(within(todos()).getAllByRole('listitem')).toHaveLength(7);
    expect(within(todos()).getByText(/۱۲۰ دلار کانادا/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'آپلود فایل' })).toHaveAttribute('href', '/documents');

    expect(screen.getByRole('region', { name: 'آخرین پیام‌های تیکت' })).toHaveTextContent(
      'کارنامه را در پرونده ثبت کردم',
    );
    expect(
      screen.getByRole('link', { name: /^University of Toronto، ۱۸ روز مانده، آماده‌ی ارسال$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'خلاصه‌ی پرونده' })).toHaveTextContent(
      '۴۵٬۰۰۰٬۰۰۰',
    );
  });

  it('approves an application', async () => {
    const user = userEvent.setup();
    await openHome();
    await user.click(screen.getByRole('button', { name: 'تأیید اپلای McGill University' }));
    expect(
      await screen.findByRole('link', { name: /^McGill University، .* آماده‌ی ارسال$/ }),
    ).toBeInTheDocument();
    expect(within(todos()).queryByText(/McGill/)).not.toBeInTheDocument();
  });

  it('asks before rejecting an application', async () => {
    const user = userEvent.setup();
    await openHome();
    await user.click(screen.getByRole('button', { name: 'رد اپلای University of Waterloo' }));
    expect(screen.getByText(/اپلای University of Waterloo رد شود؟/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'انصراف' }));
    expect(screen.queryByText(/رد شود؟/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'رد اپلای University of Waterloo' }));
    await user.click(screen.getByRole('button', { name: 'رد اپلای' }));
    expect(await screen.findByText('۶ مورد')).toBeInTheDocument();
    expect(screen.queryByText('University of Waterloo')).not.toBeInTheDocument();
  });

  it('replies to the ticket and rates a reply', async () => {
    const user = userEvent.setup();
    await openHome();
    const ticket = screen.getByRole('region', { name: 'آخرین پیام‌های تیکت' });
    expect(within(ticket).getByText('۱ جدید')).toBeInTheDocument();

    await user.type(within(ticket).getByLabelText('پاسخ سریع به حسین رحیمی'), 'ممنون، عالی است');
    await user.click(within(ticket).getByRole('button', { name: 'ارسال' }));
    expect(await within(ticket).findByText('ممنون، عالی است')).toBeInTheDocument();
    expect(within(ticket).getByLabelText('پاسخ سریع به حسین رحیمی')).toHaveValue('');
    expect(within(ticket).queryByText('۱ جدید')).not.toBeInTheDocument();

    await user.click(within(ticket).getByRole('button', { name: 'امتیاز ۴ از ۵' }));
    expect(await within(ticket).findByText('امتیاز شما: ۴ از ۵')).toBeInTheDocument();
  });

  it('welcomes someone without a contract: the journey, previews and what is open now', async () => {
    // Before the quiz is on the server; with it, the quiz takes the journey's place (estimate tests).
    const onServer = ON_SERVER as Record<ServerFeature, boolean>;
    onServer.estimate = false;
    onTestFinished(() => {
      onServer.estimate = true;
    });
    loginAs(MARYAM);
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، به اسکورایز خوش آمدید', level: 1 }),
    ).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'از اولین مشاوره تا ویزا، همه‌چیز در یک پنل' });
    expect(within(hero).getAllByRole('listitem')).toHaveLength(6);
    expect(within(hero).getByRole('link', { name: 'رزرو مشاوره‌ی اپلای' })).toHaveAttribute(
      'href',
      '/consultation/',
    );
    expect(within(hero).getByRole('button', { name: 'درخواست تماس مشاور' })).toBeInTheDocument();

    const previews = screen.getByRole('region', { name: 'پنل شما بعد از قرارداد' });
    expect(within(previews).getAllByRole('link')).toHaveLength(4);
    expect(within(previews).getByRole('link', { name: /^قرارداد و پرداخت/ })).toHaveAttribute(
      'href',
      '/contract',
    );
    const open = screen.getByRole('region', { name: 'همین حالا در دسترس شماست' });
    expect(within(open).getByRole('link', { name: /^مشاوره/ })).toHaveAttribute(
      'href',
      '/consultation/',
    );
  });

  it('leads someone without a contract toward one: readiness, a free review, ways to start', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/');
    const readiness = await screen.findByRole('region', { name: 'پرونده‌ی شما چقدر آماده است؟' });
    expect(within(readiness).getAllByRole('listitem')).toHaveLength(4);
    // Nothing done yet: the quiz is the next step.
    expect(within(readiness).queryByText('انجام شد')).toBeNull();
    expect(within(readiness).getByRole('link', { name: 'شروع تخمین' })).toHaveAttribute(
      'href',
      '/estimate',
    );

    const review = screen.getByRole('region', { name: 'مدارک‌تان را برای ارزیابی رایگان بفرستید' });
    await user.click(within(review).getByRole('radio', { name: 'رزومه' }));
    await user.upload(
      within(review).getByLabelText('انتخاب فایل رزومه'),
      new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
    );
    expect(
      await toasts().findByText('مدرک رسید. کارشناس ما برای نتیجه‌ی ارزیابی تماس می‌گیرد.'),
    ).toBeInTheDocument();
    const sent = await within(review).findByRole('list', { name: 'مدارک فرستاده‌شده' });
    expect(within(sent).getByText('رزومه')).toBeInTheDocument();
    expect(await within(readiness).findByText('انجام شد')).toBeInTheDocument();

    const paths = screen.getByRole('region', { name: 'از کجا شروع کنیم؟' });
    expect(within(paths).getByRole('link', { name: 'رزرو مشاوره' })).toHaveAttribute(
      'href',
      '/consultation/',
    );
    expect(
      within(paths).getByRole('button', { name: 'درخواست تماس برای قرارداد' }),
    ).toBeInTheDocument();
  });

  it('puts a booked session first, with what to fill before it', async () => {
    loginAs(SARA);
    localStorage.setItem('scorize.mock.access', 'guest');
    renderApp('/');
    const session = await screen.findByRole('region', { name: 'مشاوره‌ی تخصصی اپلای دکترا' });
    expect(within(session).getByText('فرم سوابق را کامل کنید')).toBeInTheDocument();
    const links = within(session).getAllByRole('link', { name: 'تکمیل' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/background',
      '/consultations/41',
    ]);
  });

  it('saves the tablet form', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/background');
    await screen.findByRole('heading', { name: 'فرم سوابق', level: 1 });
    expect(
      screen.getByText('برای کامل شدن: شهر و دست‌کم یک مدرک با دانشگاه و معدل.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('شهر محل زندگی'), 'اصفهان');
    await user.click(screen.getByRole('button', { name: 'افزودن مدرک تحصیلی' }));
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی فرم' }));
    expect(screen.getByLabelText('دانشگاه')).toHaveFocus();
    expect(screen.getByLabelText('دانشگاه')).toHaveAccessibleDescription('این بخش را پر کنید.');
    await user.type(screen.getByLabelText('دانشگاه'), 'دانشگاه اصفهان');
    await user.type(screen.getByLabelText('معدل'), '۱۷٫۵');
    await user.click(screen.getByRole('button', { name: 'افزودن آزمون' }));
    await user.type(screen.getByLabelText('نمره'), '7');
    await user.click(screen.getByRole('button', { name: 'ذخیره‌ی فرم' }));
    expect(await toasts().findByText('فرم سوابق ذخیره شد.')).toBeInTheDocument();
    expect(await screen.findByText('فرم کامل است؛ مشاور همه‌چیز را دارد.')).toBeInTheDocument();
  });

  it('tells someone whose contract is in review where it stands', async () => {
    loginAs(SARA);
    localStorage.setItem('scorize.mock.access', 'pending');
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'سلام سارا، قرارداد شما ثبت شد', level: 1 }),
    ).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'قرارداد پذیرش و نگارش · کانادا و آلمان' });
    const current = within(hero)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('بررسی و تأیید');
    expect(within(hero).queryByRole('button')).toBeNull();
    expect(within(hero).queryByRole('link')).toBeNull();
    // The prepayment is paid on the contract page; the home only points there.
    const action = screen.getByRole('link', { name: /یک کار در صفحه‌ی قرارداد/ });
    expect(action).toHaveAttribute('href', '/contract');
    expect(action).toHaveTextContent('پیش‌پرداخت قرارداد (۱٬۲۰۰٬۰۰۰ تومان) را بپردازید');
    expect(
      screen.getByRole('region', { name: 'بخش‌هایی که به‌زودی فعال می‌شوند' }),
    ).toBeInTheDocument();
  });
});
