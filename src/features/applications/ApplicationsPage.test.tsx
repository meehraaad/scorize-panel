import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // applicant with 12 applications (src/mocks/applicant.ts)
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openPage = async (path = '/applications') => {
  loginAs(SARA);
  const router = renderApp(path);
  await screen.findByRole('heading', { name: 'اپلای‌ها و نتایج', level: 1 });
  return router;
};

const list = () => screen.getByRole('region', { name: 'فهرست اپلای‌ها' });
const rows = () => within(list()).getAllByRole('listitem');
const filter = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'فیلتر اپلای‌ها' })).getByRole('button', { name });
const stat = (label: string) =>
  within(screen.getByRole('region', { name: 'خلاصه‌ی اپلای‌ها' })).getByText(label).parentElement;

describe('applications page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the summary, the first page of applications, visa and professor emails', async () => {
    await openPage();
    expect(stat('اپلای انجام‌شده')).toHaveTextContent('۱۲از ۱۵');
    expect(stat('منتظر تأیید شما')).toHaveTextContent('۲');
    expect(stat('در جریان بررسی')).toHaveTextContent('۶');
    expect(stat('پذیرش')).toHaveTextContent('۲');

    expect(rows()).toHaveLength(10);
    expect(within(list()).getByText('۱–۱۰ از ۱۲ اپلای')).toBeInTheDocument();
    expect(within(list()).getByText('تبریک! پذیرش شما ثبت شد')).toBeInTheDocument();

    const visa = screen.getByRole('region', { name: 'نتایج ویزا' });
    expect(within(visa).getByText('منتظر برگزاری جلسه‌ی سفارت')).toBeInTheDocument();

    const emails = screen.getByRole('region', { name: 'ایمیل به استادها' });
    expect(await within(emails).findByText('صفحه‌ی ۱ از ۱۸')).toBeInTheDocument();
  });

  it('filters by tab, keeps the tab in the address, and searches', async () => {
    const user = userEvent.setup();
    const router = await openPage();

    await user.click(filter(/^منتظر تأیید شما/));
    await waitFor(() => {
      expect(filter(/^منتظر تأیید شما/)).toHaveAttribute('aria-pressed', 'true');
    });
    expect(router.state.location.search).toBe('?filter=awaiting');
    expect(rows()).toHaveLength(2);

    await user.click(filter(/^همه/));
    await waitFor(() => {
      expect(rows()).toHaveLength(10);
    });
    await user.type(
      within(list()).getByRole('searchbox', { name: 'جستجوی دانشگاه یا رشته' }),
      'tu ',
    );
    expect(await within(list()).findByText('TU Munich')).toBeInTheDocument();
    expect(within(list()).getByText('TU Berlin')).toBeInTheDocument();
    expect(within(list()).queryByText('UBC')).not.toBeInTheDocument();

    await user.type(within(list()).getByRole('searchbox'), 'xyz');
    expect(
      await within(list()).findByText('اپلایی با «\u2068tu xyz\u2069» پیدا نشد.'),
    ).toBeInTheDocument();
    await user.click(within(list()).getByRole('button', { name: 'پاک کردن جستجو' }));
    expect(rows()).toHaveLength(10);
  });

  it('opens on the tab in the address', async () => {
    await openPage('/applications?filter=rejected');
    expect(filter(/^رد شده/)).toHaveAttribute('aria-pressed', 'true');
    expect(within(list()).getByText('University of Edinburgh')).toBeInTheDocument();
    expect(within(list()).getByText('University of Ottawa')).toBeInTheDocument();
    expect(within(list()).getByText('رد کردید')).toBeInTheDocument();
  });

  it('approves, and rejects after a confirmation', async () => {
    const user = userEvent.setup();
    await openPage('/applications?filter=awaiting');

    await user.click(screen.getByRole('button', { name: 'تأیید اپلای McGill University' }));
    expect(await within(list()).findByText('University of Waterloo')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(list()).queryByText('McGill University')).not.toBeInTheDocument();
    });
    expect(filter(/^منتظر تأیید شما/)).toHaveTextContent('۱');

    await user.click(screen.getByRole('button', { name: 'رد اپلای University of Waterloo' }));
    await user.click(screen.getByRole('button', { name: 'رد اپلای' }));
    expect(await within(list()).findByText('اپلایی در این دسته نیست.')).toBeInTheDocument();
    expect(filter(/^رد شده/)).toHaveTextContent('۳');
  });

  it('shows the supervisor note on request', async () => {
    const user = userEvent.setup();
    await openPage('/applications?filter=inReview');
    // RWTH Aachen: the first application in this tab with a note.
    const toggle = within(list()).getAllByRole('button', { name: 'توضیحات سوپروایزر' }).at(0);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    if (toggle) await user.click(toggle);
    expect(within(list()).getByText(/یکی از دو توصیه‌نامه هنوز ارسال نشده/)).toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: 'بستن توضیحات' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('answers the "show my admission on the site" question once', async () => {
    const user = userEvent.setup();
    await openPage('/applications?filter=accepted');
    await user.click(within(list()).getByRole('button', { name: 'بله، اجازه می‌دهم' }));
    expect(await screen.findByText('۲ اپلای')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(list()).queryByText('تبریک! پذیرش شما ثبت شد')).not.toBeInTheDocument();
    });
  });

  it('pages through professor emails', async () => {
    const user = userEvent.setup();
    await openPage();
    const emails = screen.getByRole('region', { name: 'ایمیل به استادها' });
    await within(emails).findByText('صفحه‌ی ۱ از ۱۸');
    expect(within(emails).getByRole('button', { name: 'قبلی' })).toBeDisabled();
    await user.click(within(emails).getByRole('button', { name: 'بعدی' }));
    expect(await within(emails).findByText('صفحه‌ی ۲ از ۱۸')).toBeInTheDocument();
    expect(within(emails).getByRole('button', { name: 'قبلی' })).toBeEnabled();
  });

  it('explains the page to someone without a contract', async () => {
    loginAs(MARYAM);
    renderApp('/applications');
    // A locked preview with sample data (canvas V7), not their case: src/app/locks.test.tsx.
    expect(await screen.findByRole('region', { name: 'این بخش قفل است' })).toBeInTheDocument();
    expect(screen.getByText('University of Toronto').closest('[inert]')).not.toBeNull();
  });
});
