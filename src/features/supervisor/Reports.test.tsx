import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const MARYAM = 2; // supervisor (src/mocks/supervisor.ts)

describe('supervisor reports and CSV import', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(MARYAM));
  });

  it('reports the month: numbers, chart, countries, follow-ups', async () => {
    const user = userEvent.setup();
    renderApp('/supervisor/reports');
    expect(await screen.findByRole('heading', { name: 'گزارش‌ها', level: 1 })).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'خلاصه‌ی بازه' });
    expect(within(summary).getByText('اپلای ارسال‌شده')).toBeInTheDocument();
    expect(within(summary).getByText('هدف تیم: ۹۰٪')).toBeInTheDocument();

    const chart = screen.getByRole('list', { name: 'اپلای‌های ارسال‌شده در ۶ ماه اخیر' });
    expect(within(chart).getAllByRole('listitem')).toHaveLength(6);
    expect(within(chart).getAllByRole('listitem')[0]).toHaveAccessibleName(
      /۶ اپلای ارسال‌شده، ۱ پذیرش/,
    );

    const countries = screen.getByRole('region', { name: 'نتیجه‌ی اپلای‌ها بر اساس کشور' });
    expect(within(countries).getByRole('rowheader', { name: 'کانادا' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'زمان پاسخ به تیکت‌ها' })).toHaveTextContent(
      '۳ ساعت',
    );
    expect(
      screen.getByRole('link', { name: 'دیدن پرونده‌هایی که ربات‌شان خاموش است' }),
    ).toHaveAttribute('href', '/supervisor/files?bot=off');
    expect(screen.getByRole('link', { name: 'خروجی اکسل' })).toHaveAttribute(
      'href',
      '/api/supervisor/v1/reports/export/?period=month',
    );

    await user.click(screen.getByRole('button', { name: 'ماه قبل' }));
    expect(await screen.findByText('هدف تیم: ۹۰٪')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'خروجی اکسل' })).toHaveAttribute(
      'href',
      '/api/supervisor/v1/reports/export/?period=last_month',
    );
  });

  it('imports results from a CSV after showing what changes', async () => {
    // Let a wrong file through the picker, as a drop would.
    const user = userEvent.setup({ applyAccept: false });
    renderApp('/supervisor/files');
    await user.click(await screen.findByRole('button', { name: 'ورود نتایج از CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'ورود نتایج از CSV' });

    // Only CSV files.
    await user.upload(
      within(dialog).getByLabelText('انتخاب فایل CSV'),
      new File(['x'], 'results.pdf', { type: 'application/pdf' }),
    );
    expect(within(dialog).getByText('فقط فایل CSV قابل قبول است.')).toBeInTheDocument();

    const csv = [
      'file,university,program,deadline,result',
      '1240,UBC,MDS Data Science,,accepted',
      '1240,TU Munich,MSc Informatics,,accepted',
      '1240,Uppsala University,MSc Data Science,,submitted',
      '1188,University of Twente,MSc,,submitted',
    ].join('\n');
    await user.upload(
      within(dialog).getByLabelText('انتخاب فایل CSV'),
      new File([csv], 'results-aban.csv', { type: 'text/csv' }),
    );

    const summary = await within(dialog).findByRole('list', { name: 'خلاصه‌ی تغییرها' });
    expect(within(summary).getByText('۱ نتیجه به‌روز می‌شود')).toBeInTheDocument();
    expect(within(summary).getByText('۱ اپلای تازه')).toBeInTheDocument();
    expect(within(summary).getByText('۱ بدون تغییر')).toBeInTheDocument();
    expect(within(summary).getByText('۱ ردیف ثبت نمی‌شود')).toBeInTheDocument();
    expect(within(dialog).getByText(/پرونده‌ی #۱۱۸۸ پیدا نشد/)).toBeInTheDocument();
    expect(within(dialog).getByText('پرونده پیدا نشد')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'ثبت ۲ تغییر' }));
    expect(await within(dialog).findByText('۲ تغییر ثبت شد.')).toBeInTheDocument();
    const [close] = within(dialog).getAllByRole('button', { name: 'بستن' });
    if (close) await user.click(close);

    // The case shows the new results.
    renderApp('/supervisor/files/1240/applications');
    expect(await screen.findByText('Uppsala University')).toBeInTheDocument();
  });
});
