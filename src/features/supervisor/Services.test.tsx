import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { withoutExecutivePanel } from '@/mocks/handlers';
import '@/test/server';
import { toasts } from '@/test/toasts';

// The services page waits for Django (src/lib/applicant/onServer.ts): switch it on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, clientServices: true } };
});

const MARYAM = 2; // supervisor with can_assign_supervisor (src/mocks/handlers.ts)

describe('client services (SVC2)', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(MARYAM));
    await i18n.changeLanguage('fa');
  });

  it('lists the case services and hands the visa to the visa team', async () => {
    const user = userEvent.setup();
    withoutExecutivePanel(MARYAM); // case files open here only without it
    renderApp('/supervisor/files/1240');
    const card = await screen.findByRole('region', { name: 'خدمت‌ها' });
    const rows = within(card).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('پذیرش · کانادا'),
      expect.stringContaining('پذیرش · آلمان'),
      expect.stringContaining('ویزا · کانادا'),
      expect.stringContaining('ویزا · آلمان'),
    ]);
    expect(rows[0]).toHaveTextContent('مریم کاظمی');
    expect(rows[2]).toHaveTextContent('بی‌مسئول');

    await user.click(within(card).getByRole('button', { name: 'تعیین مسئول ویزا · کانادا' }));
    const dialog = await screen.findByRole('dialog', { name: 'مسئول ویزا · کانادا' });
    const select = await within(dialog).findByRole('combobox', { name: 'مسئول' });
    // The visa team's person for Canada is suggested; the admission-only staff aren't offered.
    expect(select).toHaveDisplayValue(/نگار صادقی/);
    expect(within(select).queryByRole('option', { name: /علی نوری/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'سپردن ویزا · کانادا' }));

    expect(await toasts().findByText('ویزا · کانادا به نگار صادقی سپرده شد.')).toBeInTheDocument();
    const updated = await screen.findByRole('region', { name: 'خدمت‌ها' });
    expect(await within(updated).findByText('نگار صادقی')).toBeInTheDocument();
  });

  it('lists the open services nobody owns on the new-cases page', async () => {
    renderApp('/executive/manager');
    const card = await screen.findByRole('region', { name: 'خدمت‌های بی‌مسئول' });
    expect(within(card).getAllByRole('link', { name: 'سارا محمدی' })).toHaveLength(2);
    expect(within(card).getByText('ویزا · آلمان')).toBeInTheDocument();
  });

  it('opens a tab per service with its owner, stages and tool (SVC9)', async () => {
    const user = userEvent.setup();
    withoutExecutivePanel(MARYAM); // case files open here only without it
    renderApp('/supervisor/files/1240');
    const nav = await screen.findByRole('navigation', { name: 'خدمت‌های این پرونده' });
    await user.click(within(nav).getByRole('link', { name: /ویزا · کانادا/ }));

    const tab = await screen.findByRole('region', { name: 'ویزا · کانادا' });
    expect(within(tab).getByText('بی‌مسئول')).toBeInTheDocument();
    expect(within(tab).getByRole('button', { name: 'گفتگوی این خدمت' })).toBeInTheDocument();
    const stages = within(tab).getByRole('list', { name: 'مرحله‌ها' });
    expect(within(stages).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('region', { name: 'نتیجه‌های ویزا' })).toBeInTheDocument();
  });

  it('an admission tab lists its country’s applications and adds one for that country', async () => {
    const user = userEvent.setup();
    withoutExecutivePanel(MARYAM); // case files open here only without it
    renderApp('/supervisor/files/1240/services/124001');
    const tool = await screen.findByRole('region', { name: 'اپلای‌های آلمان' });
    const before = within(tool).getAllByRole('row').length;
    await user.click(within(tool).getByRole('button', { name: 'افزودن اپلای' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('دانشگاه'), 'TU Berlin');
    await user.type(within(dialog).getByLabelText('رشته'), 'Physics');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره‌ی تغییرات' }));
    await waitFor(() => expect(within(tool).getAllByRole('row')).toHaveLength(before + 1));
    expect(within(tool).getAllByText('TU Berlin').length).toBeGreaterThan(0);
  });

  it('chooses an owner right on the new-cases page', async () => {
    const user = userEvent.setup();
    renderApp('/executive/manager');
    const card = await screen.findByRole('region', { name: 'خدمت‌های بی‌مسئول' });
    await user.click(
      within(card).getByRole('button', { name: 'انتخاب مسئول ویزا · آلمان برای سارا محمدی' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'مسئول ویزا · آلمان' });
    await within(dialog).findByRole('combobox', { name: 'مسئول' });
    await user.click(within(dialog).getByRole('button', { name: 'سپردن ویزا · آلمان' }));
    expect(await toasts().findByText(/^ویزا · آلمان به .+ سپرده شد\.$/)).toBeInTheDocument();
    await waitFor(() => expect(within(card).queryByText('ویزا · آلمان')).not.toBeInTheDocument());
  });

  it('moves a visa service to another stage and shows its visa results (SVC4)', async () => {
    const user = userEvent.setup();
    withoutExecutivePanel(MARYAM); // case files open here only without it
    renderApp('/supervisor/files/1240');
    const card = await screen.findByRole('region', { name: 'خدمت‌ها' });
    expect(within(card).getAllByText('مدارک ویزا')).toHaveLength(2);
    await user.click(within(card).getByRole('button', { name: 'مرحله‌ی ویزا · آلمان' }));
    const dialog = await screen.findByRole('dialog', { name: 'مرحله‌ی ویزا · آلمان' });
    expect(await within(dialog).findByText('ویزای تحصیلی')).toBeInTheDocument();
    expect(within(dialog).getByText('در حال گرفتن نوبت')).toBeInTheDocument();
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'مرحله' }),
      'گرفتن نوبت سفارت',
    );
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره‌ی مرحله‌ی ویزا · آلمان' }));
    expect(await toasts().findByText('ویزا · آلمان: گرفتن نوبت سفارت')).toBeInTheDocument();
    const updated = await screen.findByRole('region', { name: 'خدمت‌ها' });
    await waitFor(() => {
      const row = within(updated)
        .getAllByRole('listitem')
        .find((item) => item.textContent.includes('ویزا · آلمان'));
      expect(row).toHaveTextContent('گرفتن نوبت سفارت');
    });
  });

  it('lists the services the supervisor owns, unread first (SVC4)', async () => {
    renderApp('/supervisor/services');
    const list = await screen.findByRole('region', { name: 'خدمت‌هایی که مسئولشان هستید' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('سارا محمدی');
    expect(rows[0]).toHaveTextContent('پذیرش · کانادا');
    expect(within(list).queryByText(/ویزا/)).toBeNull();
  });

  it('gives a supervisor a scope until nothing differs from today (SVC5)', async () => {
    const user = userEvent.setup();
    renderApp('/executive/manager/scopes');
    const differences = await screen.findByRole('region', { name: 'اختلاف با قاعده‌ی امروز' });
    expect(within(differences).getByText('۱ اختلاف')).toBeInTheDocument();
    expect(within(differences).getByRole('link', { name: 'رضا احمدی' })).toBeInTheDocument();

    const form = screen.getByRole('region', { name: 'محدوده‌ی تازه' });
    await user.selectOptions(within(form).getByRole('combobox', { name: 'سرپرست' }), 'علی نوری');
    await user.selectOptions(within(form).getByRole('combobox', { name: 'کشور' }), 'ایتالیا');
    await user.click(within(form).getByRole('button', { name: 'افزودن محدوده' }));
    expect(
      await toasts().findByText('محدوده‌ی همه‌ی خدمت‌ها · ایتالیا به علی نوری داده شد.'),
    ).toBeInTheDocument();
    expect(await within(differences).findByText('بدون اختلاف')).toBeInTheDocument();

    const people = screen.getByRole('region', { name: 'سرپرست‌ها' });
    // A domain lead («سرپرست دامنه») also chooses the owners of its services.
    const lead = within(people).getByRole('checkbox', { name: 'سرپرست دامنه' });
    expect(lead).not.toBeChecked();
    await user.click(lead);
    expect(
      await toasts().findByText('علی نوری سرپرست همه‌ی خدمت‌ها · ایتالیا شد.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(lead).toBeChecked());
    await user.click(
      within(people).getByRole('button', {
        name: 'حذف محدوده‌ی همه‌ی خدمت‌ها · ایتالیا از علی نوری',
      }),
    );
    expect(await within(people).findByText('هنوز محدوده‌ای تعریف نشده.')).toBeInTheDocument();
  });

  it('shows how each team and owner answers, by period (SVC6)', async () => {
    const user = userEvent.setup();
    renderApp('/executive/manager/services');
    const teams = await screen.findByRole('region', { name: 'تیم‌ها' });
    expect(within(teams).getByText('تیم ویزا')).toBeInTheDocument();
    const owners = screen.getByRole('region', { name: 'مسئول‌ها' });
    const rows = within(owners).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('نگار صادقی');
    expect(rows[0]).toHaveTextContent('۲ ساعت');
    expect(within(owners).getByText('بی‌مسئول')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '۷ روز' }));
    expect(await within(owners).findByText('۳')).toBeInTheDocument(); // 14 answers a month, 3 a week
  });

  it('shows the admission stage, read from the case, without a stage button (SVC6)', async () => {
    withoutExecutivePanel(MARYAM); // case files open here only without it
    renderApp('/supervisor/files/1240');
    const card = await screen.findByRole('region', { name: 'خدمت‌ها' });
    expect(within(card).getAllByText('اپلای')).toHaveLength(2);
    expect(within(card).queryByRole('button', { name: 'مرحله‌ی پذیرش · کانادا' })).toBeNull();
  });

  it('records a visa result and the visa service moves on', async () => {
    const user = userEvent.setup();
    withoutExecutivePanel(MARYAM); // case files open here only without it
    renderApp('/supervisor/files/1240');
    const card = await screen.findByRole('region', { name: 'خدمت‌ها' });
    await user.click(within(card).getByRole('button', { name: 'مرحله‌ی ویزا · کانادا' }));
    const dialog = await screen.findByRole('dialog', { name: 'مرحله‌ی ویزا · کانادا' });
    await user.click(await within(dialog).findByRole('button', { name: 'ثبت نتیجه‌ی ویزا' }));
    const form = within(dialog).getByRole('region', { name: 'نتیجه‌ی تازه‌ی ویزا' });
    // An embassy session needs its date and proof: the form says so before sending.
    await user.selectOptions(
      within(form).getByRole('combobox', { name: 'وضعیت' }),
      'منتظر جلسه‌ی سفارت',
    );
    await user.click(within(form).getByRole('button', { name: 'ثبت نتیجه' }));
    expect(within(form).getByText('تاریخ نوبت را وارد کنید.')).toBeInTheDocument();
    expect(within(form).getByText('مدرک نوبت را آپلود کنید.')).toBeInTheDocument();

    await user.selectOptions(
      within(form).getByRole('combobox', { name: 'وضعیت' }),
      'در حال گرفتن نوبت',
    );
    await user.selectOptions(within(form).getByRole('combobox', { name: 'سفارت در' }), 'ایتالیا');
    await user.click(within(form).getByRole('button', { name: 'ثبت نتیجه' }));
    expect(await toasts().findByText('نتیجه‌ی ویزا ثبت شد: در حال گرفتن نوبت')).toBeInTheDocument();
    expect(await within(dialog).findByText('سفارت: ایتالیا')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'انصراف' }));
    const updated = await screen.findByRole('region', { name: 'خدمت‌ها' });
    await waitFor(() => {
      const row = within(updated)
        .getAllByRole('listitem')
        .find((item) => item.textContent.includes('ویزا · کانادا'));
      expect(row).toHaveTextContent('گرفتن نوبت سفارت');
    });
  });
});
