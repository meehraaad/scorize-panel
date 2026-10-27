import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { patchMockActivity } from '@/mocks/activities';

// Django doesn't serve activities yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: { ...ON_SERVER, activities: true } };
});

const SARA = 1; // four to-dos (src/mocks/activities.ts)
const MARYAM = 2; // none

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('the to-do box', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('opens from the pill, required first, and answers a survey in place', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: /کارهای شما: ۴/ }));

    const box = screen.getByRole('dialog', { name: 'کارهای شما' });
    expect(box).toHaveTextContent('۴ کار · ۲ لازم');
    const items = within(box).getAllByRole('heading', { level: 3 });
    expect(items.map((item) => item.textContent)).toEqual([
      'اسکن صفحه‌ی اول پاسپورت',
      'فرم انگیزه‌نامه',
      'بعد از جلسه‌ی دیروز، تصمیمت چی شد؟',
      'جلسه‌ی مشاوره چطور بود؟',
    ]);
    // A started form opens its page; required ones can't be dismissed.
    expect(within(box).getByRole('link', { name: 'ادامه' })).toHaveAttribute(
      'href',
      '/documents/sop',
    );
    expect(within(box).getAllByRole('button', { name: 'رد کردن' })).toHaveLength(2);

    const survey = items[2]?.closest('li');
    if (!survey) throw new Error('survey row missing');
    await user.click(within(survey).getByRole('button', { name: 'ارسال' }));
    expect(within(survey).getByRole('alert')).toHaveTextContent('اول یک گزینه را انتخاب کنید.');
    await user.click(within(survey).getByRole('radio', { name: 'هنوز فکر می‌کنم' }));
    await user.click(within(survey).getByRole('button', { name: 'ارسال' }));

    expect(await screen.findByText('ممنون؛ جوابتان فرستاده شد.')).toBeInTheDocument();
    expect(await within(box).findByText('۳ کار · ۲ لازم')).toBeInTheDocument();
  });

  it('puts one off and collapses back to the pill', async () => {
    const user = userEvent.setup();
    loginAs(SARA);
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: /کارهای شما: ۴/ }));
    const box = screen.getByRole('dialog', { name: 'کارهای شما' });
    const [first] = within(box).getAllByRole('button', { name: 'بعداً' });
    if (!first) throw new Error('no later button');
    await user.click(first);
    expect(await screen.findByText('فردا دوباره یادآوری می‌کنیم.')).toBeInTheDocument();
    expect(await within(box).findByText('۳ کار · ۱ لازم')).toBeInTheDocument();

    await user.click(within(box).getByRole('button', { name: 'جمع کردن کارها' }));
    expect(await screen.findByRole('button', { name: /کارهای شما: ۳/ })).toBeInTheDocument();
  });

  it('opens by itself for an urgent to-do, once a day', async () => {
    loginAs(SARA);
    patchMockActivity(SARA, 902, { level: 'urgent' });
    renderApp('/');
    expect(await screen.findByRole('dialog', { name: 'کارهای شما' })).toBeInTheDocument();

    // The same day, on the next visit: only the pill.
    cleanup();
    renderApp('/');
    expect(await screen.findByRole('button', { name: /کارهای شما: ۴/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'کارهای شما' })).not.toBeInTheDocument();
  });

  it('stays out of the way while paying, and when there is nothing to do', async () => {
    loginAs(SARA);
    const router = renderApp('/');
    expect(await screen.findByRole('button', { name: /کارهای شما/ })).toBeInTheDocument();
    await router.navigate('/payments/1');
    await screen.findByRole('heading', { name: 'جزئیات پرداخت', level: 1 });
    expect(screen.queryByRole('button', { name: /کارهای شما/ })).not.toBeInTheDocument();

    loginAs(MARYAM);
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /کارهای شما/ })).not.toBeInTheDocument();
  });
});
