import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const SARA = 1; // bought packages, a booked consultation, events, saved GPA (src/mocks/applicant.ts)
const MARYAM = 2; // no contract, nothing bought: the page is open to her too

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const open = async (id: number) => {
  loginAs(id);
  renderApp('/services');
  await screen.findByRole('heading', { name: 'دیگر خدمات', level: 1 });
};

describe('other services', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the wallet, sections, packages, consultations and events', async () => {
    await open(SARA);
    expect(screen.getByText('۵٬۰۰۰ تومان')).toBeInTheDocument();

    const sections = screen.getByRole('navigation', { name: 'بخش‌های این صفحه' });
    expect(within(sections).getByRole('link', { name: /^بسته‌های من/ })).toHaveAttribute(
      'href',
      '#packages',
    );
    expect(within(sections).getByRole('link', { name: /آخرین نتیجه: ۳٫۵/ })).toBeInTheDocument();

    const webinar = screen.getByRole('region', { name: 'اپلای کارشناسی ارشد کانادا ۲۰۲۷' });
    expect(within(webinar).getByRole('timer')).toBeInTheDocument();
    expect(within(webinar).getByText(/ثبت‌نام کرده‌اید/)).toBeInTheDocument();

    const packages = screen.getByRole('region', { name: 'بسته‌های من' });
    expect(within(packages).getByText('آمادگی تافل ۱۲۰')).toBeInTheDocument();
    expect(within(packages).getByText('بسته‌ی آمادگی آیلتس ۷ قدم')).toBeInTheDocument();

    const consultations = screen.getByRole('region', { name: 'مشاوره‌های من' });
    expect(within(consultations).getByText('مشاوره‌ی تخصصی اپلای دکترا')).toBeInTheDocument();
    expect(within(consultations).getByRole('link', { name: 'رزرو مشاوره' })).toHaveAttribute(
      'href',
      '/consultation/',
    );

    const events = screen.getByRole('region', { name: 'رویدادهای من' });
    expect(within(events).getByRole('link', { name: 'لینک ورود' })).toBeInTheDocument();
    expect(within(events).getByRole('link', { name: 'دانلود فیلم' })).toBeInTheDocument();
    expect(within(events).getByText(/فیلم به‌زودی/)).toBeInTheDocument();
  });

  it('calculates GPA from the courses', async () => {
    const user = userEvent.setup();
    await open(SARA);
    const gpa = screen.getByRole('region', { name: 'محاسبه‌ی آنلاین GPA' });
    expect(within(gpa).getByText('۱۱')).toBeInTheDocument(); // credits

    await user.click(within(gpa).getByRole('button', { name: 'افزودن درس' }));
    await user.click(within(gpa).getByRole('button', { name: 'ثبت و محاسبه' }));
    expect(within(gpa).getByRole('alert')).toHaveTextContent('برای هر درس نام');

    await user.type(within(gpa).getByLabelText('نام درس ۵'), 'Databases');
    await user.type(within(gpa).getByLabelText('واحد درس ۵'), '۳');
    await user.type(within(gpa).getByLabelText('نمره‌ی درس ۵'), '۲۰');
    expect(within(gpa).getByText('۱۴')).toBeInTheDocument();
    await user.click(within(gpa).getByRole('button', { name: 'ثبت و محاسبه' }));
    // (18.5×3 + 19×3 + 15.25×3 + 17×2 + 20×3) / 14 = 17.98 → 3.6 in the fake.
    expect(await within(gpa).findByText('۳٫۶')).toBeInTheDocument();

    await user.click(within(gpa).getByRole('button', { name: 'حذف درس ۵' }));
    expect(within(gpa).queryByLabelText('نام درس ۵')).toBeNull();
  });

  it('signs someone up for a free webinar', async () => {
    const user = userEvent.setup();
    await open(MARYAM);
    expect(screen.getByRole('region', { name: 'رویدادهای من' })).toHaveTextContent(
      'در هیچ رویدادی شرکت نکرده‌اید',
    );
    await user.click(screen.getByRole('button', { name: 'ثبت‌نام در وبینار' }));
    expect(await screen.findByText(/ثبت‌نام کرده‌اید/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'رویدادهای من' })).getByRole('link', {
        name: 'لینک ورود',
      }),
    ).toBeInTheDocument();
  });

  it('sends a paid webinar to the payment page', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/applicant/v1/services/webinars/:id/register/', () =>
        HttpResponse.json({ payment_id: 502 }),
      ),
    );
    await open(MARYAM);
    await user.click(screen.getByRole('button', { name: 'ثبت‌نام در وبینار' }));
    // Maryam has no invoices in the fake: the payment page says so, at the right address.
    expect(
      await screen.findByText('این پرداخت پیدا نشد. شاید پیوند قدیمی است.'),
    ).toBeInTheDocument();
  });
});
