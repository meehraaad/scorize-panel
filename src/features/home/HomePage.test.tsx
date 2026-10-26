import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ON_SERVER, type ServerFeature } from '@/lib/applicant/onServer';
import i18n from '@/lib/i18n';
import { addHeldConsultation, feedbackSent } from '@/mocks/applicant';
import { bookingsSent, setStartOffers } from '@/mocks/journey';
import { renderApp } from '@/test/renderApp';
import { toasts } from '@/test/toasts';
import { onDesktop } from '@/test/viewport';
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

    // After the first file: it arrived, a time for the session, what Turkey still needs.
    expect(await screen.findByRole('region', { name: 'رزومه شما رسید' })).toBeInTheDocument();
    const turkey = screen.getByRole('region', { name: 'برای ترکیه فقط ۳ مدرک دیگر لازم است' });
    await user.click(within(turkey).getByRole('button', { name: 'آپلود پاسپورت' }));
    expect(within(review).getByRole('radio', { name: 'پاسپورت' })).toBeChecked();
    expect(
      screen.getByRole('region', { name: 'ارزیابی را در یک جلسه با مشاور مرور کنید' }),
    ).toBeInTheDocument();

    // The ways to start: the consultation's nearest times and price, the contract's instalment.
    const paths = screen.getByRole('region', { name: 'از کجا شروع کنیم؟' });
    const consult = within(paths).getByRole('region', { name: 'مشاوره‌ی تخصصی' });
    expect(within(consult).getAllByRole('radio')).toHaveLength(3);
    expect(within(consult).getByText('۵۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    const contract = within(paths).getByRole('region', { name: 'قرارداد اپلای' });
    expect(within(contract).getByText('۲۱٬۲۵۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(
      within(contract).getByRole('button', { name: 'درخواست تماس برای قرارداد' }),
    ).toBeInTheDocument();

    // Booking a time goes to the bank gateway.
    await user.click(within(consult).getAllByRole('radio')[1] as HTMLElement);
    const assign = vi.fn();
    const { href, origin, protocol, host, hostname, port, pathname, search, hash } =
      window.location;
    vi.stubGlobal('location', {
      href,
      origin,
      protocol,
      host,
      hostname,
      port,
      pathname,
      search,
      hash,
      assign,
    });
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    await user.click(within(consult).getByRole('button', { name: /^رزرو / }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/finance/payment-ip-check/AUTH77/'));
    expect(bookingsSent).toHaveLength(1);
  });

  it('before a booked session: the countdown, the calendar, its topics and their seller', async () => {
    loginAs(MARYAM);
    addHeldConsultation(MARYAM, -2);
    setStartOffers(MARYAM, { consultant: { name: 'سارا احمدی', picture: null } });
    const createUrl = vi.fn(() => 'blob:ics');
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    renderApp('/');
    const session = await screen.findByRole('region', { name: 'مشاوره‌ی اپلای کارشناسی ارشد' });
    expect(within(session).getByRole('timer')).toHaveAccessibleName(/۱ روز، ۲۳ ساعت|۲ روز/);
    await user.click(within(session).getByRole('button', { name: 'افزودن به تقویم' }));
    expect(createUrl).toHaveBeenCalledOnce();
    const topics = screen.getByRole('region', { name: 'در جلسه درباره‌ی این‌ها حرف می‌زنیم' });
    expect(within(topics).getAllByRole('listitem')).toHaveLength(4);
    expect(
      screen.getByRole('region', { name: 'بعد از جلسه: پیشنهاد قرارداد شما' }),
    ).toHaveTextContent('بعد از جلسه باز می‌شود');
    const consultant = screen.getByRole('region', { name: 'سارا احمدی' });
    expect(
      within(consultant).getByRole('button', { name: 'با من تماس بگیرید' }),
    ).toBeInTheDocument();
  });

  it('first visit: the result locked beside the quiz, and booking in a dialog on its first choice', async () => {
    onDesktop();
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/');
    expect(await screen.findByRole('region', { name: 'شانس شما در هر کشور' })).toBeInTheDocument();
    const talk = screen.getByRole('region', { name: 'ترجیح می‌دهید حرف بزنید؟' });
    const how = within(talk).getByRole('group', { name: 'نحوه‌ی برگزاری جلسه' });
    await user.click(within(how).getByRole('button', { name: /^حضوری/ }));
    const dialog = await screen.findByRole('dialog', { name: 'رزرو مشاوره' });
    expect(
      await within(dialog).findByRole('radio', { name: 'حضوری' }, { timeout: 15_000 }),
    ).toBeChecked();
    const topics = within(dialog).getByRole('group', { name: 'موضوع جلسه‌ی حضوری' });
    expect(within(topics).getByRole('radio', { name: /اپلای حضوری/ })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'بستن' }));
    expect(screen.queryByRole('dialog', { name: 'رزرو مشاوره' })).toBeNull();
  });

  it('first visit: a free call instead, which asks for a phone first', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/');
    const talk = await screen.findByRole('region', { name: 'ترجیح می‌دهید حرف بزنید؟' });
    await user.click(within(talk).getByRole('button', { name: 'اول یک تماس رایگان' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('first visit without a consultation on offer: the call alone', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    setStartOffers(MARYAM, { consultation: null });
    renderApp('/');
    const call = await screen.findByRole('region', { name: 'ترجیح می‌دهید حرف بزنید؟' });
    await user.click(within(call).getByRole('button', { name: 'با من تماس بگیرید' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('asks about the consultant after a session, then offers the step that fits', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    addHeldConsultation(MARYAM, 2);
    renderApp('/');
    const card = await screen.findByRole('region', { name: 'جلسه با نیلوفر شریفی چطور بود؟' });
    await user.click(within(card).getByRole('button', { name: 'ارسال' }));
    expect(within(card).getByText('به هر سه سؤال جواب دهید.')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: '۴ از ۵' }));
    expect(within(card).getByRole('button', { name: '۴ از ۵' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(card).getByRole('radio', { name: 'تا حدی' }));
    await user.click(within(card).getByRole('radio', { name: /هزینه برایم سؤال است/ }));
    await user.click(within(card).getByRole('button', { name: 'ارسال' }));
    expect(await toasts().findByText('ممنون! جواب شما به ما رسید.')).toBeInTheDocument();
    expect(feedbackSent).toEqual([
      { id: 90, answer: { rating: 4, clear: 'partly', next: 'cost', comment: '' } },
    ]);

    const thanks = await screen.findByRole('region', { name: 'ممنون از نظرتان' });
    expect(within(thanks).getByRole('button', { name: 'تماس درباره‌ی ترکیه' })).toBeInTheDocument();
    // Consulted: no more consultation offer among the ways to start.
    const paths = screen.getByRole('region', { name: 'از کجا شروع کنیم؟' });
    expect(within(paths).queryByRole('link', { name: 'رزرو مشاوره' })).toBeNull();
  });

  it('remembers a session long past, without the first-visit or readiness blocks', async () => {
    loginAs(MARYAM);
    addHeldConsultation(MARYAM, 45);
    renderApp('/');
    const card = await screen.findByRole('region', {
      name: 'جلسه‌تان با نیلوفر شریفی یادتان هست؟',
    });
    expect(within(card).getByRole('link', { name: 'جزئیات جلسه' })).toHaveAttribute(
      'href',
      '/consultations/90',
    );
    expect(
      within(card).getByRole('button', { name: 'سؤال دارم، تماس بگیرید' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'پرونده‌ی شما چقدر آماده است؟' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'ترجیح می‌دهید حرف بزنید؟' })).toBeNull();
    expect(screen.queryByRole('region', { name: /چطور بود؟$/ })).toBeNull();
    const paths = screen.getByRole('region', { name: 'از کجا شروع کنیم؟' });
    expect(within(paths).queryByRole('link', { name: 'رزرو مشاوره' })).toBeNull();
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
