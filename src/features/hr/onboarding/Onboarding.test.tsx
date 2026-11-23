import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { mockSubmittedForm } from '@/mocks/hr';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

// The form isn't on the server yet (docs/backend-changes.md OB1–OB8): tested as it will be.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, hrOnboarding: true } };
});

const HIRE = 603; // Bahar Niko: staff 3, joining today, her form open (src/mocks/hr.ts)
const AMIR = 6; // superuser: holds can_manage_support_staff
const BAHAR_FILE = 3;

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('new-hire form', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('opens first after login, says what is missing, and goes to HR once complete', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    const router = renderApp('/start');
    expect(
      await screen.findByRole('heading', { name: 'فرم اطلاعات فردی', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me/onboarding');
    // Prefilled from the staff file HR made.
    expect(screen.getByLabelText('نام')).toHaveValue('بهار');
    expect(screen.getByLabelText('محل تولد')).toHaveValue('تهران');
    expect(screen.getByLabelText('شماره شناسنامه')).toHaveValue('4003');
    // One birth date, two genders.
    expect(screen.queryByText('تاریخ تولد واقعی')).toBeNull();
    expect(screen.getAllByRole('radio', { name: /^(مرد|زن)$/ })).toHaveLength(2);

    const send = screen.getByRole('button', { name: 'ارسال' });
    await user.click(send);
    expect(screen.getAllByText('این فیلد را کامل کنید').length).toBeGreaterThan(5);
    expect(screen.getByText('تصویر شناسنامه و کارت ملی را بارگذاری کنید')).toBeInTheDocument();

    const code = screen.getByLabelText('کد ملی');
    await user.type(code, '0499370898');
    expect(screen.getByText('کد ملی درست نیست')).toBeInTheDocument();
    await user.clear(code);
    await user.type(code, '۰۴۹۹۳۷۰۸۹۹');
    expect(screen.queryByText('کد ملی درست نیست')).toBeNull();

    await user.type(screen.getByLabelText('نام به انگلیسی'), 'Bahar');
    await user.type(screen.getByLabelText('نام خانوادگی به انگلیسی'), 'Niko');
    await user.type(screen.getByLabelText('نام پدر'), 'حسن');
    await user.click(screen.getByRole('radio', { name: 'زن' }));
    await user.type(screen.getByLabelText('محل صدور شناسنامه'), 'تهران');
    await user.click(screen.getByRole('radio', { name: 'کارشناسی' }));
    await user.type(screen.getByLabelText('رشته‌ی تحصیلی'), 'مدیریت');
    await user.type(screen.getByLabelText('دانشگاه یا مؤسسه'), 'دانشگاه تهران');
    await user.click(screen.getByRole('radio', { name: 'مجرد' }));
    await user.click(screen.getByRole('radio', { name: 'مشمول نیستم' }));
    await user.type(screen.getByLabelText('شماره‌ی شبا'), 'IR82 0540 1026 8002 0817 9090 02');
    await user.type(screen.getByLabelText('نام بانک'), 'ملت');
    await user.type(screen.getByLabelText('ایمیل'), 'bahar.niko@gmail.com');
    await user.type(screen.getByLabelText('نشانی محل سکونت'), 'تهران، خیابان آزادی');
    await user.type(screen.getByLabelText('نام مخاطب'), 'مریم نیکو');
    await user.type(screen.getByLabelText('نسبت با شما'), 'مادر');
    await user.type(screen.getByLabelText('شماره تماس'), '09121234567');

    await user.upload(
      screen.getByLabelText('انتخاب فایل برای تصویر شناسنامه'),
      new File(['x'], 'shenasname.pdf', { type: 'application/pdf' }),
    );
    await screen.findByText('shenasname.pdf');
    await user.upload(
      screen.getByLabelText('انتخاب فایل برای تصویر کارت ملی'),
      new File(['x'], 'melli.jpg', { type: 'image/jpeg' }),
    );
    await screen.findByText('melli.jpg');
    expect(screen.queryByText('این فیلد را کامل کنید')).toBeNull();

    // Ali's ID card number: Django refuses it on submit, under the field.
    const idNumber = screen.getByLabelText('شماره شناسنامه');
    await user.clear(idNumber);
    await user.type(idNumber, '4001');
    await user.click(send);
    expect(
      await screen.findByText('A staff file with this ID card number exists.'),
    ).toBeInTheDocument();
    await user.clear(idNumber);
    await user.type(idNumber, '۴۰۰۳');

    await user.click(send);
    expect(await toasts().findByText('فرم برای منابع انسانی فرستاده شد')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'فرم را فرستادید. منابع انسانی آن را بررسی می‌کند و اگر چیزی لازم باشد خبرتان می‌کند.',
      ),
    ).toBeInTheDocument();
    // Sent: read only, with the IBAN as it was cleaned up.
    expect(screen.queryByRole('button', { name: 'ارسال' })).toBeNull();
    expect(screen.getByText('IR۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲')).toBeInTheDocument();
  });

  it('refuses a file of the wrong type before sending it', async () => {
    const user = userEvent.setup({ applyAccept: false });
    loginAs(HIRE);
    renderApp('/me/onboarding');
    await user.upload(
      await screen.findByLabelText('انتخاب فایل برای تصویر کارت ملی'),
      new File(['x'], 'melli.docx', { type: 'application/msword' }),
    );
    expect(screen.getByText('فقط PDF، JPG یا PNG')).toBeInTheDocument();
  });

  it('shows HR the form waiting for them on the staff list and the day', async () => {
    mockSubmittedForm(BAHAR_FILE);
    loginAs(AMIR);
    renderApp('/hr/staff');
    const list = await screen.findByRole('list', { name: 'کارکنان' });
    expect(within(list).getByText('فرم در انتظار بررسی')).toBeInTheDocument();
    cleanup();
    renderApp('/hr');
    const counts = await screen.findByRole('region', { name: 'شمار کارکنان' });
    expect(within(counts).getByText('فرم‌های در انتظار بررسی')).toBeInTheDocument();
  });

  it('lets HR approve a sent form into the staff file', async () => {
    const user = userEvent.setup();
    mockSubmittedForm(BAHAR_FILE);
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    // A form waiting for HR opens its tab first.
    const card = await screen.findByRole('region', { name: 'فرم اطلاعات فردی' });
    expect(within(card).getByText('در انتظار بررسی')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    expect(await toasts().findByText('فرم تأیید و در پرونده ثبت شد')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(card).getByText('تأیید شده')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'مشخصات' }));
    expect(await screen.findByText('اطلاعات تکمیلی')).toBeInTheDocument();
    expect(screen.getByText('مشمول نیستم')).toBeInTheDocument();
  });

  it('returns a form with a note the hire sees on top', async () => {
    const user = userEvent.setup();
    mockSubmittedForm(BAHAR_FILE);
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    await user.click(await screen.findByRole('button', { name: 'برگرداندن برای اصلاح' }));
    const dialog = await screen.findByRole('dialog', { name: 'برگرداندن فرم' });
    await user.click(within(dialog).getByRole('button', { name: 'برگرداندن' }));
    expect(within(dialog).getByText('این فیلد را کامل کنید')).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText('چه چیزی را باید اصلاح کند؟'),
      'شبا را بررسی کنید',
    );
    await user.click(within(dialog).getByRole('button', { name: 'برگرداندن' }));
    expect(await toasts().findByText('فرم برای اصلاح برگشت')).toBeInTheDocument();

    // The hire's turn: HR's page goes, hers opens.
    cleanup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    expect(
      await screen.findByText('منابع انسانی فرم را برای اصلاح برگرداند: شبا را بررسی کنید'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeInTheDocument();
  });

  it('lets HR send the form to a current employee', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/1');
    await user.click(await screen.findByRole('button', { name: 'فرم استخدام' }));
    expect(
      await screen.findByText('هنوز فرمی برای این کارمند فرستاده نشده است.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ارسال فرم برای کارمند' }));
    expect(await toasts().findByText('فرم برای علی رضایی فرستاده شد')).toBeInTheDocument();
    expect(await screen.findByText('کارمند هنوز فرم را نفرستاده است.')).toBeInTheDocument();
  });
  it('opens a new staff member’s file on the invite HR sends them', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '09121112233');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '20000000');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));

    const invite = await screen.findByRole('region', { name: 'دعوت به فرم' });
    // No name until the hire types it: a greeting without one.
    expect(invite).toHaveTextContent('سلام،');
    expect(invite).not.toHaveTextContent('سلام 0912');
    expect(invite).toHaveTextContent('09121112233');
    // The panel's login, then the form (BASE_URL is "/panel/" in a build, "/" in tests).
    const link = `${window.location.origin}${import.meta.env.BASE_URL}login?next=${encodeURIComponent(`${import.meta.env.BASE_URL}me/onboarding`)}`;
    expect(invite).toHaveTextContent(link);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(within(invite).getByRole('button', { name: 'کپی پیام' }));
    expect(await toasts().findByText('کپی شد')).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith(expect.stringContaining(link));
  });
  it('points the hire back to their form from the account menu', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    await user.click(
      await screen.findByRole('button', {
        name: 'حساب کاربری · فرم اطلاعات فردی منتظر تکمیل است',
      }),
    );
    const link = screen.getByRole('link', { name: /منتظر تکمیل/ });
    expect(link).toHaveTextContent('فرم اطلاعات فردی');
  });
});
