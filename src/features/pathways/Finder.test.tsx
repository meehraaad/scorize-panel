import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // an applicant (src/mocks/applicant.ts)
const REZA = 4; // a sales manager (not a superuser)
const AMIR = 6; // a superuser, the marketing manager's area too (src/mocks/pathways.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('pathway finder', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the first country beside the questions, without stopping them', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/pathways');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    await user.click(await screen.findByRole('radio', { name: /^کار/ }));
    // Germany needs only the degree and English: those come first.
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    await user.click(screen.getByRole('radio', { name: 'کارشناسی' }));
    // An option's number on the keyboard picks it (4: IELTS 7 to 8).
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    await user.keyboard('4');
    // The questions go on (Canada's age) while Germany's route opens beside them.
    expect(await screen.findByRole('heading', { name: 'چند سالت است؟' })).toBeInTheDocument();
    const peek = await screen.findByRole('status');
    expect(peek).toHaveTextContent('اولین راهت پیدا شد');
    expect(peek).toHaveTextContent('کارت فرصت');
    await user.click(screen.getByRole('button', { name: 'ببین چرا' }));
    expect(await screen.findByRole('heading', { name: 'کارت فرصت' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ادامه بده: (3|۳) سؤال تا کانادا/ }));
    // Number questions start at a likely value: Next keeps it.
    await screen.findByRole('heading', { name: 'چند سالت است؟' });
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: 'چند سال سابقه کار مرتبط با رشته‌ات داری؟' });
    await user.click(screen.getByRole('button', { name: 'یکی بیشتر' }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    // A question about each country: only Canada's route asks it here.
    await screen.findByRole('heading', { name: 'از کارفرمای کدام کشور پیشنهاد کار داری؟' });
    await user.click(screen.getByRole('checkbox', { name: 'کانادا' }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    expect(
      await screen.findByRole('heading', { name: /این (2|۲) راه برای تو مناسب‌ترند/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'کار ماهر فدرال' })).toBeInTheDocument();
  });

  it('management lists the routes by country with their status', async () => {
    loginAs(AMIR);
    renderApp('/marketing/manage/pathways');
    expect(await screen.findByRole('heading', { name: 'آلمان' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /کار ماهر ۱۸۹.*منتظر بررسی/ })).toBeInTheDocument();
  });

  it('the sales manager edits the same routes, and the old management address leads there', async () => {
    loginAs(REZA);
    renderApp('/founders/pathways/1');
    expect(await screen.findByRole('link', { name: 'بازگشت به مسیرها' })).toHaveAttribute(
      'href',
      '/sales/manager/pathways',
    );
  });
});
