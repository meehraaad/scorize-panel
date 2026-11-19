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

  it('shows a first country after the fewest questions, then more for more countries', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/pathways');
    await user.click(await screen.findByRole('radio', { name: 'کار' }));
    // Germany needs only the degree and English: those come first.
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    await user.click(screen.getByRole('radio', { name: 'کارشناسی' }));
    await user.click(await screen.findByRole('radio', { name: 'آیلتس ۷ تا ۸' }));
    expect(await screen.findByRole('heading', { name: 'اولین راهت پیدا شد' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'کارت فرصت' })).toBeInTheDocument();
    // Canada is two questions away (age, work years).
    await user.click(screen.getByRole('button', { name: /ادامه بده: (2|۲) سؤال تا کانادا/ }));
    await user.type(await screen.findByRole('textbox', { name: 'سن (سال)' }), '30');
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await user.type(await screen.findByRole('textbox', { name: 'سال‌های سابقه' }), '4');
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
