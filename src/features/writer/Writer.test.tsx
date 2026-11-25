import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { clearCaseChats } from '@/lib/supervisor/caseChats';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

const MARYAM = 2; // also a writer (src/mocks/writer.ts)

describe('Executive writing orders', () => {
  beforeEach(async () => {
    localStorage.clear();
    clearCaseChats();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(MARYAM));
  });

  it('lists the orders waiting on the writer, soonest due first', async () => {
    const user = userEvent.setup();
    const router = renderApp('/writer');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، ۴ سفارش منتظر شماست' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/executive/writing');
    const list = screen.getByRole('region', { name: 'منتظر من' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('سارا محمدی');
    expect(rows[0]).toHaveTextContent('درخواست اصلاح دور ۱؛ متقاضی ۳ نکته نوشته است');
    expect(rows[0]).toHaveTextContent('۲ روز مانده');
    expect(
      within(list).getByRole('link', { name: 'باز کردن سفارش انگیزه‌نامه سارا محمدی' }),
    ).toHaveAttribute('href', '/executive/writing/orders/1240');

    const week = screen.getByRole('region', { name: 'تحویل‌های این هفته' });
    expect(within(week).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'ظرفیت شما' })).toHaveTextContent('۶ سفارش باز');

    await user.click(screen.getByRole('button', { name: /تحویل‌شده/ }));
    expect(await screen.findByText('علی نوری')).toBeInTheDocument();
  });

  it('shows an order and sends the revised version to the applicant', async () => {
    const user = userEvent.setup();
    const router = renderApp('/writer/orders/1240');
    expect(
      await screen.findByRole('heading', { name: 'انگیزه‌نامه · سارا محمدی', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/executive/writing/orders/1240');
    expect(screen.getByText('درخواست اصلاح · دور ۱ از ۲')).toBeInTheDocument();
    const versions = screen.getByRole('region', { name: 'نسخه‌ها' });
    expect(within(versions).getByText(/Vector Institute/)).toBeInTheDocument();
    // The final delivery waits for the applicant's approval (or the last round).
    expect(within(versions).getByRole('button', { name: 'تحویل نهایی' })).toBeDisabled();

    const form = screen.getByRole('region', { name: 'فرم اطلاعات متقاضی' });
    expect(within(form).getByText(/ایمنی خودروهای خودران/)).toBeVisible();

    await user.click(within(versions).getByRole('button', { name: 'ارسال برای متقاضی' }));
    expect(within(versions).getByText('اول فایل را انتخاب کنید.')).toBeInTheDocument();
    await user.upload(
      within(versions).getByLabelText('انتخاب فایل Word یا PDF'),
      new File(['x'], 'SOP-Sara-v2.pdf', { type: 'application/pdf' }),
    );
    await user.type(within(versions).getByLabelText(/توضیح برای متقاضی/), 'هر سه نکته اعمال شد.');
    await user.click(within(versions).getByRole('button', { name: 'ارسال برای متقاضی' }));
    expect(await toasts().findByText('نسخه برای متقاضی فرستاده شد.')).toBeInTheDocument();
    // The picked file's card goes once the form resets; then only the new version carries the name.
    await waitFor(() => expect(within(versions).getByText('SOP-Sara-v2.pdf')).toBeInTheDocument());
    expect(await screen.findByText('منتظر متقاضی')).toBeInTheDocument();
  });

  it('opens a bookmarked conversation in a popup over the Executive order', async () => {
    const router = renderApp('/writer/orders/1240/tickets/writing/sop');
    const dialog = await screen.findByRole('dialog', { name: 'سارا محمدی' });
    expect(await within(dialog).findByText(/فقط پاراگراف آخر هم کمی کوتاه‌تر شود/)).toBeVisible();
    expect(router.state.location.pathname).toBe('/executive/writing/orders/1240');
    expect(router.state.location.search).toBe('');
  });

  it('preserves order access for a writer without the broader Executive role', async () => {
    server.use(
      http.get('/api/profile/auth/v1/whoami/', () =>
        HttpResponse.json({
          id: MARYAM,
          first_name: 'مریم',
          last_name: 'کاظمی',
          email: null,
          phone_number: null,
          staff: null,
          is_superuser: false,
          permissions: [{ codename: 'can_write_sop' }],
          group_permissions: [],
          applicant: null,
          is_country_supervisor: false,
          executive_panel: true,
          last_workspace: 'writer',
          workspace_mode: 'always',
        } satisfies SessionUser),
      ),
    );
    const router = renderApp('/executive/customers/1240/desk/writing');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، ۴ سفارش منتظر شماست' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/executive/writing');
    const nav = within(screen.getByRole('banner')).getByRole('navigation', {
      name: 'منوی پنل اجرا',
    });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/executive/writing']);
  });
});
