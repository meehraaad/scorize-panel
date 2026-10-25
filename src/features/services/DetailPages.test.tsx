import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const SARA = 1; // packages 1–2, events 31–33 (src/mocks/applicant.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('package and event pages', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('plays a lesson and takes a review', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/services/packages/1');
    await screen.findByRole('heading', { name: 'آمادگی تافل ۱۲۰', level: 1 });

    // Where the user left off.
    expect(screen.getByRole('link', { name: 'پخش Speaking Task 2' })).toBeInTheDocument();
    const lessons = screen.getByRole('complementary', { name: 'محتوای بسته' });
    expect(within(lessons).getAllByRole('listitem')).toHaveLength(10);
    await user.click(within(lessons).getByRole('button', { name: /Reading: Inference/ }));
    expect(screen.getByText(/جلسه‌ی ۳ · .Reading: Inference/)).toBeInTheDocument();

    const review = screen.getByRole('region', { name: 'نظر شما درباره‌ی این بسته' });
    expect(within(review).getByText('با ثبت نظر، ۵۰٬۰۰۰ تومان اعتبار بگیرید')).toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: 'ثبت نظر' }));
    expect(within(review).getByLabelText('متن نظر')).toHaveAccessibleDescription(
      'چند کلمه بنویسید.',
    );
    await user.type(within(review).getByLabelText('متن نظر'), 'خیلی کمک کرد.');
    await user.click(within(review).getByRole('button', { name: 'ثبت نظر' }));
    // Saved: the review shows in place of the form.
    expect(await within(review).findByText('خیلی کمک کرد.', { selector: 'p' })).toBeInTheDocument();
  });

  it('shows an upcoming webinar, its join button and invoice', async () => {
    loginAs(SARA);
    renderApp('/services/events/31');
    await screen.findByRole('heading', { name: 'اپلای کارشناسی ارشد کانادا ۲۰۲۷', level: 1 });
    expect(screen.getByText('وبینار · ثبت‌نام شده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ورود به وبینار ·/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'دانلود فیلم · بعد از برگزاری' })).toBeDisabled();
    expect(screen.getByRole('complementary', { name: 'فاکتور ثبت‌نام' })).toHaveTextContent(
      '۲۹۰٬۰۰۰ تومان',
    );
  });

  it('offers the recording of a past event, and is linked from services', async () => {
    loginAs(SARA);
    renderApp('/services');
    const events = await screen.findByRole('region', { name: 'رویدادهای من' });
    expect(within(events).getByRole('link', { name: 'نوشتن SOP بدون اشتباه' })).toHaveAttribute(
      'href',
      '/services/events/32',
    );
    expect(within(events).getByRole('link', { name: 'جزئیات' })).toHaveAttribute(
      'href',
      '/services/events/33',
    );
    const packages = screen.getByRole('region', { name: 'بسته‌های من' });
    expect(within(packages).getByRole('link', { name: /آمادگی تافل ۱۲۰/ })).toHaveAttribute(
      'href',
      '/services/packages/1',
    );
  });

  it('says so for something that is not the user’s', async () => {
    loginAs(SARA);
    renderApp('/services/packages/99');
    expect(await screen.findByText('این مورد پیدا نشد. شاید پیوند قدیمی است.')).toBeInTheDocument();
  });
});
