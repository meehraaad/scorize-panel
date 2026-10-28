import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { payWritingOrder } from '@/mocks/writingOffers';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // SOP form: sections 1–2 answered, 2 of 4 story answers (src/mocks/applicant.ts)
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openForm = async () => {
  loginAs(SARA);
  const router = renderApp('/documents/sop');
  await screen.findByRole('heading', { name: 'اطلاعات انگیزه‌نامه', level: 1 });
  return router;
};

const serverAnswers = async () => {
  const response = await fetch(new URL('/api/applicant/v1/writing/sop/', window.location.origin));
  return ((await response.json()) as { answers: Record<string, unknown> }).answers;
};

describe('SOP information form', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens at the first unfinished section, with the others summarised', async () => {
    await openForm();
    expect(screen.getAllByText('۱۰ از ۲۱ سؤال').length).toBeGreaterThan(0);
    expect(screen.getAllByText('بخش ۳ از ۵').length).toBeGreaterThan(0);
    // Done sections show their short answers and an edit button.
    expect(
      screen.getByText('کارشناسی · مهندسی کامپیوتر · صنعتی اصفهان · ۱۷٫۲۵'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ویرایش: سوابق تحصیلی' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // The open section: its questions, with help text tied to them.
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('چرا این رشته را دوست دارید؟').value,
    ).toContain('برنامه‌نویسی پیشرفته');
    expect(screen.getByLabelText(/چرا این دانشگاه یا استاد/)).toHaveAccessibleDescription(
      /لینک صفحه‌اش را بگذارید/,
    );
    expect(screen.getByRole('button', { name: 'شروع: تجربه‌ها و پروژه‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رزومه (CV)' })).toHaveAttribute(
      'href',
      '/documents/cv',
    );
  });

  it('saves a draft shortly after typing stops', async () => {
    await openForm();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const goals = screen.getByLabelText('اهداف کوتاه‌مدت و بلندمدت و علاقه‌ی پژوهشی');
    fireEvent.change(goals, { target: { value: 'هدف من تحقیق در بینایی ماشین است.' } });
    expect(screen.getByRole('status')).toHaveTextContent('تغییرات هنوز ذخیره نشده');
    expect((await serverAnswers()).reason_to_continuation).toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(1600));
    vi.useRealTimers();
    expect(await screen.findByText(/ذخیره شد · اکنون/)).toBeInTheDocument();
    expect((await serverAnswers()).reason_to_continuation).toBe(
      'هدف من تحقیق در بینایی ماشین است.',
    );
    expect(screen.getAllByText('۱۱ از ۲۱ سؤال').length).toBeGreaterThan(0);
  });

  it('does not start final submission from an implicit form submit', async () => {
    await openForm();
    const goals = screen.getByLabelText('اهداف کوتاه‌مدت و بلندمدت و علاقه‌ی پژوهشی');
    const form = goals.closest('form');
    if (!form) throw new Error('Missing writing form');
    fireEvent.submit(form);
    expect(screen.queryByRole('group', { name: /ثبت نهایی شود؟/ })).not.toBeInTheDocument();
    expect(goals).not.toHaveAttribute('aria-invalid');
    expect(
      screen.getByRole('region', { name: 'خرید، تیکت به نویسنده و ثبت نهایی' }),
    ).toBeInTheDocument();
  });

  it('moves between sections and saves on the way', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.type(screen.getByLabelText(/چرا این دانشگاه یا استاد/), 'Prof. Fleet');
    await user.click(screen.getByRole('button', { name: 'ذخیره و بخش بعدی' }));

    const heading = screen.getByRole('heading', { name: 'تجربه‌ها و پروژه‌ها' });
    expect(heading).toHaveFocus();
    expect(screen.getByLabelText('درس‌ها و پروژه‌های موفق')).toBeInTheDocument();
    expect(screen.queryByLabelText('چرا این رشته را دوست دارید؟')).toBeNull();
    expect(await screen.findByText(/ذخیره شد/)).toBeInTheDocument();
    expect((await serverAnswers()).university_reason).toBe('Prof. Fleet');

    await user.click(screen.getByRole('button', { name: 'بخش قبلی' }));
    expect(screen.getByRole('heading', { name: 'داستان و انگیزه‌ی شما' })).toHaveFocus();
  });

  it('points to unanswered required questions on final submit', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));

    expect(
      screen.getByText('۳ سؤال اجباری بی‌پاسخ مانده است. اولین مورد را برایتان باز کردیم.'),
    ).toBeInTheDocument();
    const goals = screen.getByLabelText('اهداف کوتاه‌مدت و بلندمدت و علاقه‌ی پژوهشی');
    expect(goals).toHaveFocus();
    expect(goals).toHaveAttribute('aria-invalid', 'true');
    expect(goals).toHaveAccessibleDescription(/برای ثبت نهایی به این سؤال پاسخ دهید/);

    await user.type(goals, 'بینایی ماشین');
    expect(goals).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText(/۲ سؤال اجباری بی‌پاسخ/)).toBeInTheDocument();
    // Let the autosave finish inside this test, not in the next one.
    expect(await screen.findByText(/ذخیره شد/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('submits after a confirmation and becomes read-only', async () => {
    const user = userEvent.setup();
    await openForm();
    await user.type(screen.getByLabelText('اهداف کوتاه‌مدت و بلندمدت و علاقه‌ی پژوهشی'), 'هدف');
    await user.click(screen.getByRole('button', { name: 'ذخیره و بخش بعدی' }));
    await user.type(screen.getByLabelText('درس‌ها و پروژه‌های موفق'), 'پروژه‌ی تشخیص پلاک');
    await user.click(screen.getByRole('button', { name: 'ذخیره و بخش بعدی' }));
    await user.type(screen.getByLabelText('آینده‌ی شغلی'), 'پژوهشگر');

    await user.click(screen.getByRole('button', { name: 'ثبت نهایی' }));
    const confirm = screen.getByRole('group', { name: /ثبت نهایی شود؟/ });
    await user.click(within(confirm).getByRole('button', { name: 'ثبت نهایی' }));

    expect(await screen.findByText('اطلاعات انگیزه‌نامه ثبت نهایی شد')).toBeInTheDocument();
    expect(screen.getByLabelText('آینده‌ی شغلی')).toBeDisabled();
    expect(screen.getByLabelText('آینده‌ی شغلی')).toHaveValue('پژوهشگر');
    expect(screen.queryByRole('button', { name: 'ثبت نهایی' })).toBeNull();
  });

  it('checks the coordination phone number before saving it', async () => {
    const user = userEvent.setup();
    await openForm();
    const phone = screen.getByLabelText('شماره‌ی تماس');
    await user.clear(phone);
    await user.type(phone, '۰۹۱۲ ۳۴۵');
    await user.click(screen.getByRole('button', { name: 'ثبت' }));
    expect(phone).toHaveAccessibleDescription(/شماره‌ی موبایل را مثل/);

    await user.clear(phone);
    await user.type(phone, '۰۹۱۲ ۳۴۵ ۶۷۸۹');
    await user.click(screen.getByRole('button', { name: 'ثبت' }));
    expect(await screen.findByText('شماره ثبت شد.')).toBeInTheDocument();
    expect(phone).toHaveValue('09123456789');
  });

  it('explains when the contract has no SOP', async () => {
    loginAs(MARYAM);
    renderApp('/documents/sop');
    expect(await screen.findByText('انگیزه‌نامه جزو خدمات قرارداد شما نیست.')).toBeInTheDocument();
  });

  it('lets a new user buy before the form is complete', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    // Started from the documents tab before paying.
    await fetch(new URL('/api/applicant/v1/writing/sop/start/', window.location.origin), {
      method: 'POST',
    });

    const router = renderApp('/documents/sop');
    const bar = await screen.findByRole('region', { name: 'خرید، تیکت به نویسنده و ثبت نهایی' });
    expect(
      within(bar).getByText(/بعد از خرید هم می‌توانید پر کردن فرم را ادامه دهید/),
    ).toBeInTheDocument();
    // Before paying, the ticket over the form says what opens it.
    await user.click(within(bar).getByRole('button', { name: 'تیکت به نویسنده' }));
    const ticket = screen.getByRole('dialog', { name: 'تیم نگارش · انگیزه‌نامه' });
    expect(
      await within(ticket).findByText('تیکت‌ها با عقد قرارداد یا خرید هر یک از خدمات نگارش باز می‌شود'),
    ).toBeInTheDocument();
    await user.click(within(ticket).getByRole('button', { name: 'بستن' }));
    expect(within(bar).getByRole('button', { name: 'ثبت نهایی' })).toBeDisabled();
    expect(within(bar).queryByRole('button', { name: /ذخیره/ })).toBeNull();
    await user.click(within(bar).getByRole('button', { name: 'خرید — ۴٬۵۰۰٬۰۰۰ تومان' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/payments/600'));
  });

  it('opens the writer ticket over the form once a new user paid', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    await fetch(new URL('/api/applicant/v1/writing/sop/start/', window.location.origin), {
      method: 'POST',
    });
    payWritingOrder(MARYAM, 'sop');

    renderApp('/documents/sop');
    const tabs = await screen.findByRole('navigation', { name: 'سفارش‌های نگارش شما' });
    await user.click(within(tabs).getByRole('button', { name: 'تیکت نگارش' }));
    const ticket = screen.getByRole('dialog', { name: 'تیم نگارش · انگیزه‌نامه' });
    const text = await within(ticket).findByRole('textbox');
    await user.type(text, 'سلام، درباره‌ی بخش اهداف سؤال دارم');
    await user.click(within(ticket).getByRole('button', { name: /ارسال/ }));
    expect(await within(ticket).findByText('سلام، درباره‌ی بخش اهداف سؤال دارم')).toBeInTheDocument();
  });
});
