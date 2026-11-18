import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
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
    renderApp('/supervisor/new');
    const card = await screen.findByRole('region', { name: 'خدمت‌های بی‌مسئول' });
    expect(within(card).getAllByRole('link', { name: 'سارا محمدی' })).toHaveLength(2);
    expect(within(card).getByText('ویزا · آلمان')).toBeInTheDocument();
  });

  it('moves a visa service to another stage and shows its visa results (SVC4)', async () => {
    const user = userEvent.setup();
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
    expect(await within(updated).findByText('گرفتن نوبت سفارت')).toBeInTheDocument();
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
    renderApp('/supervisor/scopes');
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
    await user.click(
      within(people).getByRole('button', {
        name: 'حذف محدوده‌ی همه‌ی خدمت‌ها · ایتالیا از علی نوری',
      }),
    );
    expect(await within(people).findByText('هنوز محدوده‌ای تعریف نشده.')).toBeInTheDocument();
  });
});
