import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const AMIR = 6; // superuser: holds can_manage_support_staff (src/mocks/hr.ts)
const NIMA = 3; // seller: no key

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('HR panel', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows HR’s day: counts, the joining under way, a trial ending and a birthday', async () => {
    loginAs(AMIR);
    renderApp('/hr');
    expect(await screen.findByRole('heading', { name: 'امروز', level: 1 })).toBeInTheDocument();
    const moves = await screen.findByRole('region', { name: 'استخدام و جدایی‌های باز' });
    expect(within(moves).getByRole('link', { name: /بهار نیکو/ })).toBeInTheDocument();
    const ending = screen.getByRole('region', { name: 'قراردادهایی که تمام می‌شوند' });
    expect(within(ending).getByRole('link', { name: /مریم کریمی/ })).toBeInTheDocument();
    const birthdays = screen.getByRole('region', { name: 'تولدهای این هفته' });
    expect(within(birthdays).getByRole('link', { name: /مریم کریمی/ })).toBeInTheDocument();
  });

  it('sums everyone’s tasks on HR’s day and names what is worth a look', async () => {
    loginAs(AMIR);
    renderApp('/hr');
    const summary = await screen.findByRole('region', { name: 'کارهای همه' });
    expect(within(summary).getByText('۱۶')).toBeInTheDocument();
    expect(within(summary).getByText('۴ عقب‌افتاده')).toBeInTheDocument();
    const alerts = screen.getByRole('region', { name: 'این‌ها را ببینید' });
    expect(
      within(alerts).getByRole('link', { name: /تیم فروش ۴ کار عقب‌افتاده دارد/ }),
    ).toHaveAttribute('href', '/hr/staff/teams/sales');
  });

  it('shows each team’s state on the staff page and opens a team’s people', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'تیم‌ها' }));
    const teams = await screen.findByRole('list', { name: 'تیم‌ها' });
    const sales = within(teams).getByRole('link', { name: 'باز کردن تیم فروش' });
    expect(within(sales).getByText('عقب مانده')).toBeInTheDocument();
    await user.click(sales);
    expect(await screen.findByRole('heading', { name: 'تیم فروش', level: 1 })).toBeInTheDocument();
    const people = screen.getByRole('list', { name: 'افراد تیم' });
    const [first] = within(people).getAllByRole('listitem');
    if (!first) throw new Error('no people in the team');
    expect(within(first).getByRole('link', { name: /علی رضایی/ })).toBeInTheDocument();
    expect(within(first).getByText('۳ کار عقب')).toBeInTheDocument();
    const overdue = screen.getByRole('region', { name: 'کارهای عقب‌افتاده‌ی تیم' });
    expect(within(overdue).getAllByText('پیگیری مدارک سفارت')).toHaveLength(2);
    await user.click(screen.getByRole('link', { name: /تیم‌ها/ }));
    expect(await screen.findByRole('list', { name: 'تیم‌ها' })).toBeInTheDocument();
  });

  it('keeps people without the key out', async () => {
    loginAs(NIMA);
    renderApp('/hr/staff');
    await waitFor(() => {
      expect(window.location.pathname).not.toMatch(/^\/hr/);
    });
  });

  it('adds a staff member from their mobile and contract and opens the joining checklist', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    const list = await screen.findByRole('list', { name: 'کارکنان' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    // HR gives the names (the invite greets them); the ID card number is the hire's to type.
    expect(within(dialog).queryByLabelText('شماره شناسنامه')).toBeNull();
    await user.type(within(dialog).getByLabelText('نام'), 'سارا');
    await user.type(within(dialog).getByLabelText('نام خانوادگی'), 'رضایی');
    // Typed with Persian digits: the field holds Latin ones.
    const mobile = within(dialog).getByLabelText('موبایل کارمند');
    await user.type(mobile, '۰۹۱۲۱۱۱۲۲۳۳');
    expect(mobile).toHaveValue('09121112233');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '20000000');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));
    expect(
      await toasts().findByText('پرونده ساخته شد؛ پیام دعوت را برای کارمند بفرستید.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'سارا رضایی', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('در انتظار فرم')).toBeInTheDocument();
    // With the new-hire form on, the file opens on the invite: the checklist is its own tab.
    await user.click(screen.getByRole('button', { name: 'استخدام و جدایی' }));
    expect(screen.getByRole('progressbar', { name: '۰ از ۹ انجام شده' })).toBeInTheDocument();
  });

  it('asks for the missing fields before saving', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '123');
    await user.type(within(dialog).getByLabelText('نام'), 'Sara');
    await user.type(within(dialog).getByLabelText('ایمیل کاری'), 'sara@');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));
    expect(within(dialog).getByText('شماره‌ی موبایل درست نیست')).toBeInTheDocument();
    expect(within(dialog).getByText('با حروف فارسی بنویسید')).toBeInTheDocument();
    // The last name is missing.
    expect(within(dialog).getByText('این را پر کنید')).toBeInTheDocument();
    expect(within(dialog).getByText('ایمیل درست نیست')).toBeInTheDocument();
    expect(within(dialog).getByText('حقوق باید بیشتر از صفر باشد')).toBeInTheDocument();
  });

  it('ticks a checklist step', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    const step = await screen.findByRole('checkbox', { name: /ایمیل شرکتی/ });
    await user.click(step);
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: '۱ از ۹ انجام شده' })).toBeInTheDocument();
    });
  });

  it('starts someone’s leaving with its checklist', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/1');
    await user.click(await screen.findByRole('button', { name: 'شروع جدایی' }));
    const dialog = await screen.findByRole('dialog', { name: 'شروع جدایی' });
    await user.click(within(dialog).getByRole('button', { name: /^شروع جدایی / }));
    expect(await toasts().findByText('چک‌لیست جدایی باز شد')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'استخدام و جدایی' }));
    expect(
      await screen.findByRole('progressbar', { name: '۰ از ۷ انجام شده' }),
    ).toBeInTheDocument();
  });

  it('starts a joining or a leaving from the moves page, the colleague found by name', async () => {
    const NAME = 'علی رضایی';
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/moves');
    await user.click(await screen.findByRole('button', { name: 'شروع جدایی' }));
    const dialog = await screen.findByRole('dialog', { name: 'شروع جدایی' });
    const save = within(dialog).getByRole('button', { name: 'شروع جدایی' });
    expect(save).toBeDisabled();
    const people = within(dialog).getByRole('combobox', { name: 'همکار' });
    await user.type(people, NAME.slice(0, 3));
    await user.click(await within(dialog).findByRole('option', { name: new RegExp(NAME) }));
    await user.click(within(dialog).getByRole('button', { name: `شروع جدایی ${NAME}` }));
    expect(await toasts().findByText('چک‌لیست جدایی باز شد')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'کارمند جدید' }));
    expect(await screen.findByRole('dialog', { name: 'کارمند جدید' })).toBeInTheDocument();
  });

  it('ends someone’s work and brings them back with a reason', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/1');
    await user.click(await screen.findByRole('button', { name: 'شروع جدایی' }));
    const exit = await screen.findByRole('dialog', { name: 'شروع جدایی' });
    await user.click(within(exit).getByRole('button', { name: /^شروع جدایی / }));
    await user.click(await screen.findByRole('button', { name: 'استخدام و جدایی' }));
    await user.click(await screen.findByRole('button', { name: 'پایان همکاری' }));
    const confirm = await screen.findByRole('group', { name: /همکاری تمام شود/ });
    await user.click(within(confirm).getByRole('button', { name: 'پایان همکاری' }));
    expect(await toasts().findByText('همکاری تمام شد')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'بازگرداندن همکاری' }));
    const back = await screen.findByRole('dialog', { name: 'بازگرداندن همکاری' });
    const save = within(back).getByRole('button', { name: 'بازگرداندن همکاری' });
    expect(save).toBeDisabled();
    await user.type(within(back).getByLabelText('دلیل برگشت'), 'برگشت از سفر');
    await user.click(save);
    expect(await toasts().findByText('همکاری دوباره شروع شد')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'شروع جدایی' })).toBeInTheDocument();
  });

  it('changes a salary from today', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/1');
    await user.click(await screen.findByRole('button', { name: 'قرارداد و حقوق' }));
    await user.click(screen.getByRole('button', { name: 'تغییر حقوق' }));
    const dialog = await screen.findByRole('dialog', { name: 'تغییر حقوق' });
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '36000000');
    await user.click(within(dialog).getByRole('button', { name: 'ثبت حقوق' }));
    expect(await toasts().findByText('حقوق ثبت شد')).toBeInTheDocument();
    const pay = screen.getByRole('region', { name: 'حقوق و مزایا' });
    expect(within(pay).getAllByText('۳۶٬۰۰۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('shows the staff’s days on the calendar beside my tasks', async () => {
    loginAs(AMIR);
    renderApp('/hr/calendar');
    expect(await screen.findByRole('heading', { name: 'تقویم', level: 1 })).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: /استخدام بهار نیکو/ })).not.toHaveLength(0);
  });

  it('lists my tasks with no hour on the calendar’s day row and adds one for a day', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/calendar');
    const row = await screen.findByRole('group', { name: 'روزهای کارکنان و کارها' });
    // An open move's steps are due today with no hour: chips, never at an hour.
    await waitFor(() =>
      expect(
        within(row)
          .getAllByRole('link')
          .filter((link) => /\/tasks\?view=mine&day=/.test(link.getAttribute('href') ?? '')),
      ).not.toHaveLength(0),
    );
    const add = within(row).getAllByRole('button', { name: /^کار کل‌روز برای / })[0] as HTMLElement;
    await user.click(add);
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    expect(within(dialog).getByRole('radio', { name: 'فقط روز (بدون ساعت)' })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'از تقویم' })).toBeInTheDocument();
  });

  it('shows the org chart: each position under the one it reports to', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'چارت سازمانی' }));
    const manager = await screen.findByRole('region', { name: 'مدیر فروش' });
    expect(within(manager).getByText('خالی')).toBeInTheDocument();
    const sellers = screen.getByRole('region', { name: 'کارشناس فروش' });
    expect(within(sellers).getByRole('link', { name: /علی رضایی/ })).toBeInTheDocument();
    expect(within(sellers).getByRole('link', { name: /مریم کریمی/ })).toBeInTheDocument();
    expect(screen.getByText('بدون سمت (۱)')).toBeInTheDocument();
  });
});
