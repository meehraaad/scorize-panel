import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { attendanceSyncCount } from '@/mocks/attendance';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';

const AMIR = 6; // superuser: holds the attendance key (src/mocks/attendance.ts)
const NIMA = 3; // seller: no key

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('attendance section', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows today: who came when, the hours, late people and the unmapped number', async () => {
    loginAs(AMIR);
    renderApp('/attendance');
    expect(
      await screen.findByRole('heading', { name: 'گزارش روزانه', level: 1 }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table');
    const maryam = within(table).getByRole('row', { name: /مریم کریمی/ });
    expect(within(maryam).getByText('تأخیر')).toBeInTheDocument();
    const guest = within(table).getByRole('row', { name: /شماره‌ی دستگاه ۷۷/ });
    expect(within(guest).getByText('بدون کارمند')).toBeInTheDocument();
    expect(within(guest).getByText('خروج ثبت نشده')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'خروجی اکسل' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/api\/attendance\/v1\/export\/\?from=.*&file=xlsx$/),
    );
  });

  it('totals a month per person and opens a person’s days', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/attendance/month');
    const list = await screen.findByRole('region', { name: 'حضور و غیاب یک ماه' });
    const row = await within(list).findByRole('button', { name: /مریم کریمی/ });
    expect(row).toHaveTextContent('۶ روز تأخیر');
    await user.click(row);
    const days = await screen.findByRole('list', { name: 'روزهای ماه' });
    expect(within(days).getAllByRole('listitem').length).toBeGreaterThan(10);
    expect(within(days).getAllByText('تأخیر').length).toBeGreaterThan(10);
    // The next month is not offered from the current one.
    expect(screen.getByRole('button', { name: 'ماه بعد' })).toBeDisabled();
  });

  it('highlights numbers nobody is mapped to and maps one', async () => {
    const user = userEvent.setup();
    loginAs(AMIR);
    renderApp('/attendance/settings');
    expect(
      await screen.findByText('۱ شماره هنوز به کارمندی وصل نیست', { exact: false }),
    ).toBeInTheDocument();
    const select = await screen.findByLabelText('کارمند شماره‌ی دستگاه ۷۷');
    await user.selectOptions(select, 'علی رضایی');
    expect(await toasts().findByText('ذخیره شد')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('۱ شماره هنوز به کارمندی وصل نیست', { exact: false })).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'خواندن نام‌ها از دستگاه' }));
    expect(await toasts().findByText(/درخواست ثبت شد/)).toBeInTheDocument();
    expect(attendanceSyncCount()).toBe(1);
  });

  it('is only for key holders: no menu entry, no page', async () => {
    loginAs(NIMA);
    renderApp('/attendance');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'گزارش روزانه', level: 1 })).toBeNull();
    });
    expect(screen.queryByRole('link', { name: 'حضور و غیاب' })).toBeNull();
  });
});
