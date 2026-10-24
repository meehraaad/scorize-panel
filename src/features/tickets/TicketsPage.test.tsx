import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // applicant: supervisor thread (7 messages), writing threads SOP (empty) and CV
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const open = async (path = '/tickets') => {
  loginAs(SARA);
  const router = renderApp(path);
  await screen.findByRole('heading', { name: 'تیکت‌ها', level: 1 });
  return router;
};

const thread = (name: string) => screen.getByRole('region', { name });
const supervisors = () => thread('سوپروایزرهای پرونده');
const messages = () => within(screen.getByRole('list', { name: 'پیام‌ها' }));
const departments = () => screen.getByRole('navigation', { name: 'دپارتمان' });
const pdf = (name: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

describe('tickets page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the supervisors’ conversation, with earlier messages on request', async () => {
    await open();
    expect(
      within(supervisors()).getByText(
        'مریم کاظمی و حسین رحیمی · پیام شما برای همه‌ی سوپروایزرهای پرونده ارسال می‌شود',
      ),
    ).toBeInTheDocument();
    await screen.findByText(/کارنامه را در پرونده ثبت کردم/);

    // The latest page: an automatic reply, a file, a given rating, a seen marker.
    expect(messages().getByText('پاسخ خودکار')).toBeInTheDocument();
    expect(messages().getByRole('link', { name: 'recommendation-sample.pdf' })).toBeInTheDocument();
    expect(messages().getByText('امتیاز شما: ۵ از ۵')).toBeInTheDocument();
    expect(messages().getAllByText('دیده شد').length).toBeGreaterThan(0);
    expect(messages().getByText('امروز')).toBeInTheDocument();
    expect(screen.queryByText(/فرم اطلاعات انگیزه‌نامه را از کجا پر کنم/)).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'نمایش پیام‌های قبلی' }));
    expect(await screen.findByText(/فرم اطلاعات انگیزه‌نامه را از کجا پر کنم/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'نمایش پیام‌های قبلی' })).toBeNull();

    // FAQ for the supervisors, the first one open; the Friday notice.
    const help = screen.getByRole('complementary', { name: 'راهنمای تیکت‌ها' });
    expect(within(help).getByText(/بخش ایمیل به استادها ببینید/)).toBeVisible();
    expect(within(help).getByText(/جمعه‌ها قادر به پاسخ‌گویی نیستیم/)).toBeInTheDocument();
  });

  it('opens the FAQ and opening hours in a sheet (phones)', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'سؤالات متداول و ساعت پاسخ‌گویی' }));
    const sheet = screen.getByRole('dialog', { name: 'راهنمای تیکت‌ها' });
    expect(within(sheet).getByText('تا الان چند ایمیل برای استادها فرستاده شده؟')).toBeVisible();
    expect(within(sheet).getByText(/جمعه‌ها قادر به پاسخ‌گویی نیستیم/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'بستن' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rates a staff reply', async () => {
    const user = userEvent.setup();
    await open();
    await screen.findByText(/کارنامه را در پرونده ثبت کردم/);
    await user.click(messages().getByRole('button', { name: 'امتیاز ۳ از ۵' }));
    expect(await messages().findByText('امتیاز شما: ۳ از ۵')).toBeInTheDocument();
    expect(messages().queryByRole('button', { name: 'امتیاز ۳ از ۵' })).toBeNull();
  });

  it('sends a very urgent message with a file only after the rules are accepted', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await open();
    const card = within(supervisors());
    const send = card.getByRole('button', { name: 'ارسال' });
    expect(send).toBeDisabled();

    await user.type(card.getByLabelText('متن پیام'), 'لینک مصاحبه‌ی McGill باز نمی‌شود.');
    expect(send).toBeEnabled();
    expect(card.getByRole('radio', { name: 'متوسط' })).toBeChecked();

    await user.click(card.getByRole('radio', { name: 'خیلی ضروری' }));
    expect(card.getByText(/کار نکردن لینک هنگام مصاحبه/)).toBeInTheDocument();
    expect(send).toBeDisabled();
    await user.click(card.getByRole('checkbox', { name: 'قبول دارم' }));
    expect(send).toBeEnabled();

    const attach = card.getByLabelText('پیوست فایل');
    await user.upload(attach, new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(attach).toHaveAccessibleDescription(/این نوع فایل پذیرفته نمی‌شود/);
    await user.upload(attach, pdf('invite.pdf', 2.4 * 1024 * 1024));
    expect(card.getByText('invite.pdf')).toBeInTheDocument();
    expect(card.getByText('۲٫۴ مگابایت · همراه پیام ارسال می‌شود')).toBeInTheDocument();

    await user.click(send);
    const sent = (await messages().findByText('لینک مصاحبه‌ی McGill باز نمی‌شود.')).closest('li');
    expect(sent).not.toBeNull();
    if (!sent) return;
    expect(within(sent).getByText('خیلی ضروری')).toBeInTheDocument();
    expect(within(sent).getByRole('link', { name: 'invite.pdf' })).toBeInTheDocument();
    expect(within(sent).getByText('ارسال شد')).toBeInTheDocument();

    expect(card.getByLabelText('متن پیام')).toHaveValue('');
    expect(card.getByRole('radio', { name: 'متوسط' })).toBeChecked();
    expect(card.queryByRole('button', { name: 'برداشتن فایل پیوست' })).toBeNull();
    expect(card.queryByRole('checkbox', { name: 'قبول دارم' })).toBeNull();
  });

  it('opens the writing departments the contract has, each its own conversation', async () => {
    const user = userEvent.setup();
    const router = await open();
    const writing = within(departments()).getByRole('link', { name: /نگارش و سرچ/ });
    expect(writing).toHaveTextContent('۱'); // unread in the CV thread

    await user.click(writing);
    const sop = await screen.findByRole('region', { name: 'تیم نگارش · انگیزه‌نامه' });
    expect(router.state.location.pathname).toBe('/tickets/writing/sop');
    expect(within(sop).getByText(/نگارنده هنوز تعیین نشده است/)).toBeInTheDocument();
    expect(await within(sop).findByText('هنوز پیامی نفرستاده‌اید')).toBeInTheDocument();
    // The empty thread's next step puts the cursor in the composer.
    await userEvent.setup().click(within(sop).getByRole('button', { name: 'نوشتن اولین پیام' }));
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    expect(
      screen.getByText(
        'گفت‌وگو با تیم نگارش درباره‌ی نوشته‌های شما. اصلاحات را مکتوب و دقیق بنویسید.',
      ),
    ).toBeInTheDocument();

    const tabs = screen.getByRole('navigation', { name: 'دپارتمان‌های نگارش' });
    expect(within(tabs).getAllByRole('link')).toHaveLength(2);
    expect(within(tabs).getByRole('link', { name: 'انگیزه‌نامه' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(tabs).getByRole('link', { name: /رزومه/ }));
    const cv = await screen.findByRole('region', { name: 'تیم نگارش · رزومه' });
    expect(within(cv).getByText('نگارنده: الهام رضوی')).toBeInTheDocument();
    expect(await within(cv).findByText(/هر دو مورد اصلاح شد/)).toBeInTheDocument();
    // Opening it read the reply: no unread badge left on the department.
    await waitFor(() => {
      expect(within(departments()).getByRole('link', { name: 'نگارش و سرچ' })).toBeInTheDocument();
    });
  });

  it('marks the supervisors’ reply as read on the home page once opened', async () => {
    loginAs(SARA);
    const router = renderApp('/');
    expect(await screen.findByText('۱ جدید')).toBeInTheDocument();
    await router.navigate('/tickets');
    // The tickets page itself (the home card shows the same message): opening it reads the reply.
    await screen.findByRole('list', { name: 'پیام‌ها' });
    await router.navigate('/');
    await screen.findByRole('region', { name: 'آخرین پیام‌های تیکت' });
    await waitFor(() => {
      const card = screen.getByRole('region', { name: 'آخرین پیام‌های تیکت' });
      expect(within(card).queryByText('۱ جدید')).toBeNull();
    });
  });

  it('goes back to the first conversation from an unknown address', async () => {
    const router = await open('/tickets/writing/unknown');
    await screen.findByRole('region', { name: 'سوپروایزرهای پرونده' });
    expect(router.state.location.pathname).toBe('/tickets');
  });

  it('explains tickets to someone without a contract', async () => {
    loginAs(MARYAM);
    renderApp('/tickets');
    // A locked preview with a sample conversation (canvas V7): src/app/locks.test.tsx.
    expect(await screen.findByRole('region', { name: 'این بخش قفل است' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'متن پیام' })).toBeNull();
  });
});
