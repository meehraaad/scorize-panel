import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { saveSessionSummary } from '@/mocks/sessionSummaries';

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
    await screen.findByRole('heading', { name: 'جلسه‌ها و مشاوره‌ها', level: 1 });

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

  it('shows shared advice to a lead without a booking or contract, with older sessions', async () => {
    loginAs(MARYAM);
    for (let id = 1; id <= 21; id++)
      saveSessionSummary(MARYAM, {
        id,
        at: '2026-10-26T09:00:00Z',
        kind: 'تماس تلفنی',
        customer_summary: `پیشنهاد شماره ${String(id)}`,
        reservation: null,
        authors: ['نیما رستمی'],
      });
    const user = userEvent.setup();
    renderApp('/consultations');
    const summaries = await screen.findByRole('region', { name: 'خلاصه‌ی جلسه‌های شما' });
    expect(within(summaries).getAllByRole('listitem')).toHaveLength(20);
    expect(within(summaries).getByText('پیشنهاد شماره 21')).toBeInTheDocument();
    expect(within(summaries).queryByText('پیشنهاد شماره 1')).not.toBeInTheDocument();
    expect(within(summaries).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(summaries).getByRole('button', { name: 'خلاصه‌های قدیمی‌تر' }));
    expect(await within(summaries).findByText('پیشنهاد شماره 1')).toBeInTheDocument();
    expect(within(summaries).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'جلسه‌ها و مشاوره‌ها' })).toHaveAttribute(
      'href',
      '/consultations',
    );
  });

  it('shows consultation advice with a link to its booking', async () => {
    loginAs(SARA);
    saveSessionSummary(SARA, {
      id: 1,
      at: '2026-10-26T09:00:00Z',
      kind: 'جلسه مشاوره',
      customer_summary: 'رزومه را تکمیل کنید.',
      reservation: 42,
      authors: ['نیما رستمی'],
    });
    renderApp('/consultations');
    const summaries = await screen.findByRole('region', { name: 'خلاصه‌ی جلسه‌های شما' });
    expect(within(summaries).getByText('رزومه را تکمیل کنید.')).toBeInTheDocument();
    expect(within(summaries).getByRole('link', { name: 'جزئیات مشاوره' })).toHaveAttribute(
      'href',
      '/consultations/42',
    );
    const user = userEvent.setup();
    await user.click(within(summaries).getByRole('link', { name: 'جزئیات مشاوره' }));
    await screen.findByRole('heading', { name: 'مشاوره‌ی اپلای کارشناسی ارشد', level: 1 });
    expect(screen.getByText('رزومه را تکمیل کنید.')).toBeInTheDocument();
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
    await userEvent.setup().click(screen.getByRole('button', { name: 'رزرو مشاوره‌ی جدید' }));
    const dialog = await screen.findByRole('dialog', { name: 'رزرو مشاوره' });
    // Online first, on its most booked topic.
    expect(
      await within(dialog).findByRole('radio', { name: 'آنلاین' }, { timeout: 15_000 }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole('region', { name: 'زمان‌های مشاوره‌ی اپلای' }),
    ).toBeInTheDocument();
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
