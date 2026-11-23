import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { mockCompleteForm, mockSubmittedForm } from '@/mocks/hr';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

// The form isn't on the server yet (docs/backend-changes.md OB1–OB8): tested as it will be.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, hrOnboarding: true } };
});

const HIRE = 603; // Bahar Niko: staff 3, joining today, her form open (src/mocks/hr.ts)
const AMIR = 6; // superuser: holds can_manage_support_staff
const BAHAR_FILE = 3;

const API = '/api/hr/v1';

const IBAN = 'IR820540102680020817909002';

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
    // Each missing document says so under its own kind.
    expect(screen.getAllByText('این مدرک را بارگذاری کنید')).toHaveLength(2);

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
    // A woman isn't asked about military service (sent as not applicable).
    expect(screen.queryByRole('radio', { name: 'مشمول نیستم' })).toBeNull();
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

  it('approves once however fast the confirm is pressed twice', async () => {
    const user = userEvent.setup();
    mockSubmittedForm(BAHAR_FILE);
    let posts = 0;
    server.use(
      http.post(`${API}/staff/:id/onboarding/approve/`, () => {
        posts++;
        return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
      }),
    );
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    const card = await screen.findByRole('region', { name: 'فرم اطلاعات فردی' });
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    // Both clicks in one task, before React renders the button disabled.
    const confirm = within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' });
    confirm.click();
    confirm.click();
    await toasts().findByText(/پیش‌تر بررسی یا لغو شده/);
    expect(posts).toBe(1);
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
    await user.type(within(dialog).getByLabelText('نام'), 'سارا');
    await user.type(within(dialog).getByLabelText('نام خانوادگی'), 'رضایی');
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '09121112233');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '20000000');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));

    const invite = await screen.findByRole('region', { name: 'دعوت به فرم' });
    // HR gave the names: the greeting uses them.
    expect(invite).toHaveTextContent('سارا رضایی');
    expect(invite).toHaveTextContent('09121112233');
    // No share sheet in this browser: copying is the way.
    expect(within(invite).queryByRole('button', { name: 'اشتراک‌گذاری' })).toBeNull();
    // The panel's login, then the form (BASE_URL is "/panel/" in a build, "/" in tests).
    const link = `${window.location.origin}${import.meta.env.BASE_URL}login?next=${encodeURIComponent(`${import.meta.env.BASE_URL}me/onboarding`)}`;
    expect(invite).toHaveTextContent(link);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(within(invite).getByRole('button', { name: 'کپی پیام' }));
    expect(await toasts().findByText('کپی شد')).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith(expect.stringContaining(link));
  });
  it('makes one file however fast «ساخت پرونده» is pressed twice', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.post(`${API}/staff/`, () => {
        posts++;
        return HttpResponse.json({ detail: 'held' }, { status: 409 });
      }),
    );
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('نام'), 'سارا');
    await user.type(within(dialog).getByLabelText('نام خانوادگی'), 'رضایی');
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '09121112244');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '20000000');
    // Both clicks in one task, before React renders the button disabled (what a fast double click does).
    const create = within(dialog).getByRole('button', { name: 'ساخت پرونده' });
    create.click();
    create.click();
    await waitFor(() => {
      expect(posts).toBe(1);
    });
    await toasts().findByText(/همین حالا ثبت شده/);
    expect(posts).toBe(1);
  });
  it('shares the invite through the phone’s share sheet', async () => {
    const user = userEvent.setup();
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    try {
      loginAs(AMIR);
      renderApp('/hr/staff/3');
      await user.click(await screen.findByRole('button', { name: 'فرم استخدام' }));
      const invite = await screen.findByRole('region', { name: 'دعوت به فرم' });
      await user.click(within(invite).getByRole('button', { name: 'اشتراک‌گذاری' }));
      expect(share).toHaveBeenCalledWith({ text: expect.stringContaining('بهار') as string });
    } finally {
      Reflect.deleteProperty(navigator, 'share');
    }
  });

  it('switches the hire to the sent form when a draft finds it closed', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    const name = await screen.findByLabelText('نام پدر');
    // HR (or another tab) sent it meanwhile: Django answers the next draft with 409.
    mockSubmittedForm(BAHAR_FILE);
    await user.type(name, 'حسن');
    expect(
      await toasts().findByText('وضعیت فرم تغییر کرده است. صفحه به‌روز شد.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'فرم را فرستادید. منابع انسانی آن را بررسی می‌کند و اگر چیزی لازم باشد خبرتان می‌کند.',
      ),
    ).toBeInTheDocument();
  });

  it('stops offering uploads at ten files', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    for (let page = 1; page <= 10; page++) {
      await user.upload(
        await screen.findByLabelText('انتخاب فایل برای تصویر شناسنامه'),
        new File(['x'], `page-${String(page)}.pdf`, { type: 'application/pdf' }),
      );
      // The name is in the upload toast too: wait for its tile, a link to the file.
      await screen.findByRole('link', { name: new RegExp(`page-${String(page)}\\.pdf`) });
    }
    await waitFor(() => {
      expect(screen.queryByLabelText('انتخاب فایل برای تصویر شناسنامه')).toBeNull();
    });
    expect(screen.queryByLabelText('انتخاب فایل برای تصویر کارت ملی')).toBeNull();
    expect(
      screen.getByText('حداکثر ۱۰ فایل می‌توانید بفرستید. برای فایل تازه، یکی را حذف کنید.'),
    ).toBeInTheDocument();
  });

  it('tells HR when approving clashes with another file', async () => {
    const user = userEvent.setup();
    mockSubmittedForm(BAHAR_FILE);
    server.use(
      http.post(`${API}/staff/:id/onboarding/approve/`, () =>
        HttpResponse.json(
          { national_code: ['A staff file with this national code exists.'] },
          { status: 400 },
        ),
      ),
    );
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    const card = await screen.findByRole('region', { name: 'فرم اطلاعات فردی' });
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    expect(
      await toasts().findByText('A staff file with this national code exists.'),
    ).toBeInTheDocument();
  });

  it('shows HR the form as it is when another reviewer got there first', async () => {
    const user = userEvent.setup();
    mockSubmittedForm(BAHAR_FILE);
    server.use(
      http.post(`${API}/staff/:id/onboarding/approve/`, () =>
        HttpResponse.json({ detail: 'Not found.' }, { status: 404 }),
      ),
    );
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    const card = await screen.findByRole('region', { name: 'فرم اطلاعات فردی' });
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    await user.click(within(card).getByRole('button', { name: 'تأیید و ثبت در پرونده' }));
    expect(
      await toasts().findByText('این فرم پیش‌تر بررسی یا لغو شده است. وضعیت تازه نمایش داده شد.'),
    ).toBeInTheDocument();
  });

  it('says so when the same new staff member was just saved by someone else', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/staff/`, () =>
        HttpResponse.json(
          { detail: 'This staff member was just added.', code: 'exists' },
          { status: 409 },
        ),
      ),
    );
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('نام'), 'سارا');
    await user.type(within(dialog).getByLabelText('نام خانوادگی'), 'رضایی');
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '09121112244');
    await user.type(within(dialog).getByLabelText('حقوق پایه‌ی ماهانه (تومان)'), '20000000');
    await user.click(within(dialog).getByRole('button', { name: 'ساخت پرونده' }));
    expect(
      await toasts().findByText('این کارمند همین حالا ثبت شده است. فهرست را بررسی کنید.'),
    ).toBeInTheDocument();
  });

  it('sends the form once however fast Send is pressed twice', async () => {
    const user = userEvent.setup();
    mockCompleteForm(BAHAR_FILE);
    let posts = 0;
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/me/onboarding/submit/`, async () => {
        posts++;
        await held;
        return HttpResponse.json({ detail: 'This form is closed.' }, { status: 409 });
      }),
    );
    loginAs(HIRE);
    renderApp('/me/onboarding');
    const send = await screen.findByRole('button', { name: 'ارسال' });
    await user.dblClick(send);
    await waitFor(() => {
      expect(posts).toBe(1);
    });
    release();
    expect(
      await toasts().findByText('وضعیت فرم تغییر کرده است. صفحه به‌روز شد.'),
    ).toBeInTheDocument();
    expect(posts).toBe(1);
  });

  it('waits for a pause before saying the IBAN is wrong, and takes it with or without IR', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    const iban = await screen.findByLabelText('شماره‌ی شبا');
    await user.type(iban, '۸۲۰۵');
    await user.tab();
    // Left half-typed: said at once.
    expect(screen.getByText('شماره‌ی شبا درست نیست')).toBeInTheDocument();
    await user.clear(iban);
    // Persian digits become Latin as they are typed; without IR is fine.
    await user.type(iban, '۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲');
    expect(iban).toHaveValue(IBAN.slice(2));
    expect(screen.queryByText('شماره‌ی شبا درست نیست')).toBeNull();
    await user.clear(iban);
    await user.type(iban, `${IBAN}9`);
    // Wrong while typing: only once typing pauses.
    expect(screen.queryByText('شماره‌ی شبا درست نیست')).toBeNull();
    expect(await screen.findByText('شماره‌ی شبا درست نیست')).toBeInTheDocument();
    await user.type(iban, '{Backspace}');
    expect(screen.queryByText('شماره‌ی شبا درست نیست')).toBeNull();
  });

  it('suggests majors the site knows and keeps a new one as typed', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    await user.click(await screen.findByRole('radio', { name: 'کارشناسی' }));
    const major = screen.getByRole('combobox', { name: 'رشته‌ی تحصیلی' });
    await user.type(major, 'مهندسی');
    const list = await screen.findByRole('listbox', { name: 'رشته‌های پیشنهادی' });
    // Top-level majors only: no sub-field.
    expect(within(list).getByRole('option', { name: 'مهندسی کامپیوتر' })).toBeInTheDocument();
    expect(within(list).queryByRole('option', { name: /نرم‌افزار/ })).toBeNull();
    await user.click(within(list).getByRole('option', { name: 'مهندسی برق' }));
    expect(major).toHaveValue('مهندسی برق');
    await user.clear(major);
    await user.type(major, 'رشته‌ای تازه');
    expect(major).toHaveValue('رشته‌ای تازه');
  });

  it('puts away the drop zones once a document is there', async () => {
    const user = userEvent.setup();
    loginAs(HIRE);
    renderApp('/me/onboarding');
    await user.upload(
      await screen.findByLabelText('انتخاب فایل برای تصویر کارت ملی'),
      new File(['x'], 'melli.jpg', { type: 'image/jpeg' }),
    );
    await screen.findByRole('link', { name: /melli\.jpg/ });
    expect(screen.queryByLabelText('انتخاب فایل برای تصویر کارت ملی')).toBeNull();
    await user.upload(
      screen.getByLabelText('انتخاب فایل برای تصویر شناسنامه'),
      new File(['x'], 'page-1.pdf', { type: 'application/pdf' }),
    );
    await screen.findByRole('link', { name: /page-1\.pdf/ });
    // Another page: a small button, not the zone.
    expect(screen.getByText('افزودن فایل دیگر')).toBeInTheDocument();
    expect(screen.queryByText('یا فایل را اینجا رها کنید')).toBeNull();
  });

  it('gives a new staff member access from their file', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff/3');
    await user.click(await screen.findByRole('button', { name: 'دسترسی‌ها' }));
    const card = await screen.findByRole('region', { name: 'دسترسی‌ها' });
    const group = await within(card).findByRole('checkbox', { name: 'Founders' });
    await user.click(group);
    await user.click(within(card).getByRole('button', { name: 'ذخیره' }));
    expect(await toasts().findByText(/ذخیره شد/)).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'دسترسی‌ها' })).getByRole('checkbox', {
          name: 'Founders',
        }),
      ).toBeChecked();
    });
  });

  it('fills a new staff member from the account their mobile already has', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/hr/staff');
    await user.click(await screen.findByRole('button', { name: 'کارمند جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'کارمند جدید' });
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '09121110000');
    await waitFor(() => {
      expect(within(dialog).getByLabelText('نام')).toHaveValue('سارا');
    });
    expect(within(dialog).getByLabelText('نام خانوادگی')).toHaveValue('محمدی');
    expect(within(dialog).getByLabelText('ایمیل کاری')).toHaveValue('sara.m@gmail.com');
    // Someone already on staff can't get a second file.
    await user.clear(within(dialog).getByLabelText('موبایل کارمند'));
    await user.type(within(dialog).getByLabelText('موبایل کارمند'), '09121000001');
    expect(await within(dialog).findByText('این شماره پرونده‌ی کارمندی دارد')).toBeInTheDocument();
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
