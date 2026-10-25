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

const SARA = 1; // one session ahead (details missing), three behind (src/mocks/applicant.ts)
const MARYAM = 2; // none

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('consultations', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('lists the next session and every booking, with filters', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/consultations');
    await screen.findByRole('heading', { name: 'مشاوره‌های رزرو شده', level: 1 });

    const next = screen.getByRole('region', { name: 'مشاوره‌ی تخصصی اپلای دکترا' });
    expect(next).toHaveTextContent('اطلاعات جلسه هنوز کامل نشده');
    expect(within(next).getByRole('link', { name: 'تکمیل اطلاعات جلسه' })).toHaveAttribute(
      'href',
      '/consultations/41',
    );

    const all = screen.getByRole('region', { name: 'همه‌ی رزروها' });
    expect(within(all).getAllByRole('listitem')).toHaveLength(4);
    await user.click(within(all).getByRole('button', { name: /^گذشته/ }));
    expect(within(all).getAllByRole('listitem')).toHaveLength(3);
    expect(within(all).getAllByRole('link', { name: 'فاکتور و توضیحات' })).toHaveLength(3);
    expect(within(all).getByText('۳ رزرو')).toBeInTheDocument();
  });

  it('saves the session details, then shows them as done', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/consultations/41');
    await screen.findByRole('heading', { name: 'مشاوره‌ی تخصصی اپلای دکترا', level: 1 });

    const invoice = screen.getByRole('complementary', { name: 'فاکتور مشاوره' });
    expect(invoice).toHaveTextContent('۸۰۰٬۰۰۰ تومان');

    await user.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }));
    expect(screen.getByLabelText('دانشگاه فعلی')).toHaveFocus();
    await user.type(screen.getByLabelText('دانشگاه فعلی'), 'دانشگاه صنعتی اصفهان');
    await user.type(screen.getByLabelText('رشته‌ی فعلی'), 'مهندسی کامپیوتر');
    await user.type(screen.getByLabelText('مقطع فعلی'), 'کارشناسی ارشد');
    await user.type(screen.getByLabelText('توضیحات'), 'سؤال درباره‌ی فاند');
    await user.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }));
    expect(await screen.findByText('اطلاعات جلسه ثبت شد.')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'بازگشت به مشاوره‌ها' }));
    expect(await screen.findByText('اطلاعات جلسه ثبت شده')).toBeInTheDocument();
  });

  it('shows a past session read-only, and says so for an unknown one', async () => {
    loginAs(SARA);
    renderApp('/consultations/42');
    await screen.findByRole('heading', { name: 'مشاوره‌ی اپلای کارشناسی ارشد', level: 1 });
    expect(screen.getByLabelText('دانشگاه فعلی')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'ثبت اطلاعات' })).toBeNull();
  });

  it('has nothing to list for someone without bookings', async () => {
    loginAs(MARYAM);
    renderApp('/consultations');
    expect(await screen.findByText('هنوز مشاوره‌ای رزرو نکرده‌اید.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رزرو مشاوره‌ی جدید' })).toHaveAttribute(
      'href',
      '/consultation/',
    );
  });

  it('is linked from the services page', async () => {
    loginAs(SARA);
    renderApp('/services');
    const card = await screen.findByRole('region', { name: 'مشاوره‌های من' });
    expect(within(card).getByRole('link', { name: /مشاوره‌ی تخصصی اپلای دکترا/ })).toHaveAttribute(
      'href',
      '/consultations/41',
    );
    expect(within(card).getByRole('link', { name: 'همه‌ی رزروها (۴)' })).toHaveAttribute(
      'href',
      '/consultations',
    );
  });
});
