import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const MARYAM = 2; // supervisor (src/mocks/supervisor.ts)
const SARA_CASE = '/supervisor/files/1240';

describe('supervisor panel', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(MARYAM));
  });

  it('today: deadlines board, waiting cases and links by stage', async () => {
    renderApp('/supervisor');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، ۷ پرونده منتظر شماست' }),
    ).toBeInTheDocument();

    const board = screen.getByRole('region', { name: 'ددلاین‌های پیش رو' });
    const stanford = within(board).getByText('Stanford University').closest('li');
    expect(stanford).not.toBeNull();
    expect(within(stanford as HTMLElement).getByText('فی پرداخت نشده')).toBeInTheDocument();
    expect(within(board).getByText('منتظر تأیید متقاضی')).toBeInTheDocument();

    const waiting = screen.getByRole('region', { name: 'پرونده‌های منتظر شما' });
    const items = within(waiting).getAllByRole('listitem');
    // Urgent work first.
    expect(within(items[0] as HTMLElement).getByText(/فوری/)).toBeInTheDocument();
    expect(within(waiting).getByRole('link', { name: 'علی نوری' })).toHaveAttribute(
      'href',
      '/supervisor/files/1219',
    );

    const stages = screen.getByRole('navigation', { name: 'پرونده‌ها بر اساس مرحله' });
    expect(within(stages).getByRole('link', { name: /در حال اپلای/ })).toHaveAttribute(
      'href',
      '/supervisor/files?stage=applying',
    );
  });

  it('all files: filters by stage, searches, and exports the chosen cases', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/files?stage=applying');
    const list = await screen.findByRole('region', { name: 'فهرست پرونده‌ها' });
    expect(await within(list).findByRole('link', { name: 'سارا محمدی' })).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: 'لیلا امینی' })).toBeNull();

    await user.click(within(list).getByRole('button', { name: /^همه/ }));
    expect(await within(list).findByText(/از ۱۲ پرونده/)).toBeInTheDocument();
    await user.type(within(list).getByLabelText('جستجوی پرونده'), 'طاهری');
    expect(await within(list).findByRole('link', { name: 'حسین طاهری' })).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: 'سارا محمدی' })).toBeNull();

    await user.click(within(list).getByRole('checkbox', { name: 'انتخاب حسین طاهری' }));
    const selection = within(list).getByRole('region', { name: 'پرونده‌های انتخاب‌شده' });
    expect(within(selection).getByText('۱ پرونده انتخاب شد')).toBeInTheDocument();
    expect(within(selection).getByRole('link', { name: 'خروجی اپلای‌ها' })).toHaveAttribute(
      'href',
      '/api/supervisor/v1/cases/export/?ids=1201',
    );
  });

  it('case overview: summary, contract and a stage change', async () => {
    const user = userEvent.setup();
    renderApp(SARA_CASE);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'سارا محمدی' }),
    ).toBeInTheDocument();
    const progress = screen.getByRole('region', { name: 'پیشرفت اپلای' });
    expect(within(progress).getByText('اپلای پیشنهادی')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'قرارداد' })).toHaveTextContent(/روز قرارداد مانده/);
    expect(screen.getByRole('region', { name: 'کارهای باز' })).toHaveTextContent(
      'بررسی SOP نسخه‌ی دوم',
    );

    await user.click(screen.getByRole('button', { name: 'تغییر وضعیت پرونده' }));
    const dialog = await screen.findByRole('dialog', { name: 'تغییر وضعیت پرونده' });
    await user.click(within(dialog).getByRole('radio', { name: /پذیرش گرفته/ }));
    await user.type(within(dialog).getByLabelText('توضیح (اختیاری)'), 'پذیرش مونیخ');
    await user.click(within(dialog).getByRole('button', { name: 'ثبت وضعیت' }));

    const summary = screen.getByRole('region', { name: 'خلاصه‌ی پرونده' });
    expect(await within(summary).findByText('پذیرش گرفته')).toBeInTheDocument();
    expect(await screen.findByText(/وضعیت پرونده را تغییر داد: پذیرش مونیخ/)).toBeInTheDocument();
  });

  it('shows why the email bot is stuck, with a link to fix it', async () => {
    renderApp('/supervisor/files/1227');
    expect(
      await screen.findByText('ربات نمی‌تواند برای این متقاضی ایمیل بفرستد'),
    ).toBeInTheDocument();
    expect(screen.getByText(/۳ متن ایمیل ثبت شده؛ دست‌کم ۵ متن لازم است/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'افزودن متن ایمیل' })).toHaveAttribute(
      'href',
      '/supervisor/files/1227/applications',
    );
  });

  it('documents: accepts an upload, and sends one back only with a reason', async () => {
    const user = userEvent.setup();
    renderApp(`${SARA_CASE}/documents`);
    const card = await screen.findByRole('region', { name: 'مدارک خواسته‌شده' });
    const tabs = screen.getByRole('navigation', { name: 'بخش‌های پرونده' });
    expect(
      within(tabs).getByRole('link', { name: /^پرونده و مدارک\s*۱\s*مدرک منتظر بررسی$/ }),
    ).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'تأیید توصیه‌نامه‌ی دوم' }));
    expect(await within(tabs).findByRole('link', { name: 'پرونده و مدارک' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /^تأیید / })).toBeNull();

    // Another case: the language certificate waits for review.
    cleanup();
    renderApp('/supervisor/files/1238/documents');
    const docs = await screen.findByRole('region', { name: 'مدارک خواسته‌شده' });
    await user.click(within(docs).getByRole('button', { name: 'برگرداندن مدرک زبان (IELTS)' }));
    const send = within(docs).getByRole('button', { name: 'برگرداندن مدرک' });
    expect(send).toBeDisabled();
    await user.type(within(docs).getByLabelText('چرا برمی‌گردد؟'), 'مهر دانشگاه ندارد');
    await user.click(send);
    expect(await within(docs).findByText('برگشت داده شد: مهر دانشگاه ندارد')).toBeInTheDocument();
  });

  it('documents: asks the applicant for another document', async () => {
    const user = userEvent.setup();
    renderApp(`${SARA_CASE}/documents`);
    const card = await screen.findByRole('region', { name: 'مدارک خواسته‌شده' });
    await user.click(within(card).getByRole('button', { name: 'درخواست مدرک' }));
    const dialog = await screen.findByRole('dialog', { name: 'درخواست مدرک' });
    await user.type(within(dialog).getByLabelText('نام مدرک'), 'گواهی رتبه');
    await user.click(within(dialog).getByRole('button', { name: 'ارسال درخواست' }));
    expect(await within(card).findByText('گواهی رتبه')).toBeInTheDocument();
  });

  it('applications: edits one in the side panel, adds and deletes', async () => {
    const user = userEvent.setup();
    renderApp(`${SARA_CASE}/applications`);
    expect(await screen.findByText('ربات ایمیل فعال است')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ویرایش اپلای University of Toronto' }));
    let dialog = await screen.findByRole('dialog', { name: 'ویرایش اپلای' });
    await user.selectOptions(within(dialog).getByLabelText('وضعیت پرداخت فی'), 'پرداخت شده');
    await user.selectOptions(within(dialog).getByLabelText('نتیجه'), 'ارسال شده، منتظر نتیجه');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره‌ی تغییرات' }));
    const row = (await screen.findByText('University of Toronto')).closest('tr') as HTMLElement;
    expect(await within(row).findByText('ارسال شده، منتظر نتیجه')).toBeInTheDocument();
    expect(within(row).getByText('پرداخت شده')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'افزودن اپلای' }));
    dialog = await screen.findByRole('dialog', { name: 'افزودن اپلای' });
    await user.type(within(dialog).getByLabelText('دانشگاه'), 'University of Alberta');
    await user.type(within(dialog).getByLabelText('رشته'), 'MSc Computing Science');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره‌ی تغییرات' }));
    expect(await screen.findByText('University of Alberta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ویرایش اپلای KIT' }));
    dialog = await screen.findByRole('dialog', { name: 'ویرایش اپلای' });
    await user.click(within(dialog).getByRole('button', { name: 'حذف اپلای' }));
    const confirm = within(dialog).getByRole('group', { name: 'اپلای KIT حذف شود؟' });
    await user.click(within(confirm).getByRole('button', { name: 'حذف اپلای' }));
    await screen.findByRole('button', { name: 'افزودن اپلای' });
    await waitFor(() => {
      expect(screen.queryByText('KIT')).toBeNull();
    });
  });

  it('applications: the bot stops, and cannot start while it has problems', async () => {
    const user = userEvent.setup();
    renderApp(`${SARA_CASE}/applications`);
    await user.click(await screen.findByRole('button', { name: 'توقف ربات' }));
    expect(await screen.findByText('ربات ایمیل متوقف است')).toBeInTheDocument();

    cleanup();
    renderApp('/supervisor/files/1227/applications');
    expect(await screen.findByRole('button', { name: 'راه‌اندازی ربات' })).toBeDisabled();
  });

  it('applications: professor emails and login details', async () => {
    const user = userEvent.setup();
    renderApp(`${SARA_CASE}/applications`);
    await user.click(await screen.findByRole('button', { name: /ایمیل به استادها/ }));
    const emails = await screen.findByRole('region', { name: 'ایمیل به استادها' });
    expect(await within(emails).findByText('Prof. Anna Keller')).toBeInTheDocument();
    expect(within(emails).getByText(/صفحه‌ی ۱ از ۳۰/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'اطلاعات ورود' }));
    const logins = screen.getByRole('region', { name: 'اطلاعات ورود' });
    expect(within(logins).getByText('sara.m.apply@gmail.com')).toBeInTheDocument();
    expect(within(logins).queryByText('Sc0rize-1240!')).toBeNull();
    await user.click(within(logins).getByRole('button', { name: 'نمایش رمز عبور' }));
    expect(within(logins).getByText('Sc0rize-1240!')).toBeInTheDocument();
  });

  it('tickets: answers inside the case as staff, and the inbox lists who waits', async () => {
    const user = userEvent.setup();
    renderApp(`${SARA_CASE}/tickets`);
    const thread = await screen.findByRole('region', { name: 'سوپروایزرهای پرونده' });
    expect(await within(thread).findByText(/هزینه‌ی فی را خودم بپردازم/)).toBeInTheDocument();
    // Staff pick no priority and see the applicant's rating of a colleague's reply.
    expect(within(thread).queryByRole('radiogroup', { name: 'اولویت' })).toBeNull();
    expect(within(thread).getByText('امتیاز متقاضی: ۵ از ۵')).toBeInTheDocument();

    await user.type(within(thread).getByLabelText('متن پیام'), 'بله، فی را از پنل پرداخت کنید.');
    await user.click(within(thread).getByRole('button', { name: 'ارسال' }));
    expect(await within(thread).findByText('بله، فی را از پنل پرداخت کنید.')).toBeInTheDocument();

    cleanup();
    renderApp('/supervisor/tickets');
    const inbox = await screen.findByRole('region', { name: 'گفت‌وگوها' });
    const ali = await within(inbox).findByRole('link', { name: /علی نوری/ });
    expect(ali).toHaveAttribute('href', '/supervisor/files/1219/tickets');
    expect(within(ali).getByText('خیلی ضروری')).toBeInTheDocument();
    // Sara was just answered: not waiting any more.
    expect(within(inbox).queryByRole('link', { name: /سارا محمدی/ })).toBeNull();
  });

  it("tasks: the shared tasks page with the supervisor's follow-ups", async () => {
    renderApp('/supervisor/tasks');
    expect(
      await screen.findByText('فی Stanford را پرداخت کن؛ ددلاین ۵ روز دیگر است'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /مهسا جعفری/ })[0]).toHaveAttribute(
      'href',
      '/supervisor/files/1215',
    );
  });

  it('says so when the case is not one of hers', async () => {
    renderApp('/supervisor/files/9999');
    expect(await screen.findByRole('heading', { name: 'پرونده پیدا نشد' })).toBeInTheDocument();
  });
});
