import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { lastPathwayCheck, setFinderPrefill } from '@/mocks/pathways';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // an applicant (src/mocks/applicant.ts)
const MARYAM = 2; // no contract: the guest home
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

  it('starts from what the profile says, and the answers can still be changed', async () => {
    setFinderPrefill({ education: 'master', english_ielts: 7, age: 31 });
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/pathways');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    await user.click(await screen.findByRole('radio', { name: /^کار/ }));
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    expect(screen.getByRole('radio', { name: 'کارشناسی ارشد' })).toBeChecked();
    // A "what if": another answer than the profile's.
    await user.click(screen.getByRole('radio', { name: 'دکتری' }));
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    expect(screen.getByRole('radio', { name: 'آیلتس ۷ تا ۸' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: 'چند سالت است؟' });
    expect(screen.getByRole('slider', { name: 'سن (سال)' })).toHaveValue('31');
    // What was sent is the person's answers, the changed one too (Django keeps them apart from the profile).
    await waitFor(() => {
      expect(lastPathwayCheck()).toMatchObject({
        answers: { education: 'phd', english_ielts: 7.5 },
      });
    });
  });

  it('shows the first country beside the questions, without stopping them', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/pathways');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    await user.click(await screen.findByRole('radio', { name: /^کار/ }));
    // The questions take the whole screen, over the panel's menus.
    expect(await screen.findByRole('dialog', { name: 'مسیریاب مهاجرت' })).toBeInTheDocument();
    // Germany needs only the degree and English: those come first.
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    await user.click(screen.getByRole('radio', { name: 'کارشناسی' }));
    // An option's number on the keyboard picks it (4: IELTS 7 to 8).
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    await user.keyboard('4');
    // The questions go on (Canada's age) while Germany's route opens beside them.
    expect(await screen.findByRole('heading', { name: 'چند سالت است؟' })).toBeInTheDocument();
    // Each route found joins a row above the buttons; a card opens its route.
    const found = await screen.findByRole('status');
    expect(await within(found).findByText('مناسب')).toBeInTheDocument();
    await user.click(within(found).getByRole('button', { name: /کارت فرصت/ }));
    expect(await screen.findByRole('heading', { name: 'اولین راهت پیدا شد' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'کارت فرصت' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ادامه بده: (3|۳) سؤال تا کانادا/ }));
    // Number questions start at a likely value: Next keeps it.
    await screen.findByRole('heading', { name: 'چند سالت است؟' });
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: 'چند سال سابقه کار مرتبط با رشته‌ات داری؟' });
    await user.click(screen.getByRole('button', { name: 'یکی بیشتر' }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    // A question about destinations: yes or no first, then which country (Canada's route asks it).
    await screen.findByRole('heading', {
      name: 'پیشنهاد کار رسمی از یک کارفرمای خارج از ایران داری؟',
    });
    await user.click(screen.getByRole('radio', { name: 'بله، دارم' }));
    await user.click(await screen.findByRole('checkbox', { name: 'کانادا' }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    expect(
      await screen.findByRole('heading', { name: /این (2|۲) راه برای تو مناسب‌ترند/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'کار ماهر فدرال' })).toBeInTheDocument();
    // The call is the one button at the bottom; once asked, it says so instead.
    await user.click(screen.getByRole('button', { name: 'می‌خواهم با من تماس بگیرند' }));
    expect(await screen.findByText('درخواستت ثبت شد، به‌زودی تماس می‌گیریم')).toBeInTheDocument();
  });

  it('opens from the home in a popup, and closes', async () => {
    loginAs(MARYAM);
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    const quiz = await screen.findByRole('dialog', { name: 'مسیریاب مهاجرت' });
    expect(
      await within(quiz).findByRole('heading', { name: 'راه رفتنت را پیدا کن.' }),
    ).toBeInTheDocument();
    await user.click(within(quiz).getByRole('button', { name: 'شروع کن' }));
    expect(
      await within(quiz).findByRole('heading', { name: 'برای چه می‌خواهی بروی؟' }),
    ).toBeInTheDocument();
    // Phones: close asks first (carry on, start again or leave).
    await user.click(within(quiz).getByRole('button', { name: 'بستن' }));
    await user.click(await screen.findByRole('button', { name: 'بیرون برو' }));
    expect(screen.queryByRole('dialog', { name: 'مسیریاب مهاجرت' })).not.toBeInTheDocument();
  });

  it('opens alone, without the panel menus', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/finder');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    expect(
      await screen.findByRole('heading', { name: 'برای چه می‌خواهی بروی؟' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    // Start again (in the close sheet on phones) goes back to the first screen.
    await user.click(screen.getByRole('button', { name: 'بستن' }));
    await user.click(await screen.findByRole('button', { name: 'از اول شروع کن' }));
    expect(await screen.findByRole('button', { name: 'شروع کن' })).toBeInTheDocument();
  });

  it('keeps an answer after going back, and the answers after leaving', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/finder');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    await user.click(await screen.findByRole('radio', { name: /^کار/ }));
    await user.click(await screen.findByRole('radio', { name: 'کارشناسی' }));
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    // Back (at the top on phones): the degree is still picked, and Next keeps it.
    await user.click(screen.getByRole('button', { name: 'سؤال قبلی' }));
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    expect(screen.getByRole('radio', { name: 'کارشناسی' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    // Coming back later carries on at the same question.
    cleanup();
    renderApp('/finder');
    expect(
      await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' }),
    ).toBeInTheDocument();
  });

  it('a destination question is yes or no first; yes asks which country, any one by search', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/pathways');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    await user.click(await screen.findByRole('radio', { name: /^کار/ }));
    await user.click(await screen.findByRole('radio', { name: 'کارشناسی' }));
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    await user.keyboard('4');
    await screen.findByRole('heading', { name: 'چند سالت است؟' });
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: 'چند سال سابقه کار مرتبط با رشته‌ات داری؟' });
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', {
      name: 'پیشنهاد کار رسمی از یک کارفرمای خارج از ایران داری؟',
    });
    await user.click(screen.getByRole('radio', { name: 'بله، دارم' }));
    // A country without a route, found by search: it goes to the sales team.
    const other = await screen.findByRole('textbox', { name: 'کشور دیگری؟' });
    expect(screen.getByRole('button', { name: 'بعدی' })).toBeDisabled();
    await user.type(other, 'اسپا');
    await user.click(await screen.findByRole('button', { name: /اسپانیا/ }));
    expect(screen.getByRole('checkbox', { name: /اسپانیا/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'بعدی' })).toBeEnabled();
    // Back goes to yes or no; no moves on.
    await user.click(screen.getByRole('button', { name: 'سؤال قبلی' }));
    await user.click(await screen.findByRole('radio', { name: 'نه' }));
    expect(
      await screen.findByRole('heading', { name: /این (1|۱) راه برای تو مناسب‌تر|راه/ }),
    ).toBeInTheDocument();
  });

  it('a study route asks the budget, takes TOEFL, and shows the first year in tomans', async () => {
    loginAs(SARA);
    const user = userEvent.setup();
    renderApp('/pathways');
    await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
    await user.click(await screen.findByRole('radio', { name: /^تحصیل/ }));
    await user.click(await screen.findByRole('radio', { name: 'دیپلم' }));
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    // In TOEFL's scores: the same levels, worded in TOEFL.
    await user.click(screen.getByRole('radio', { name: 'تافل' }));
    await user.click(screen.getByRole('radio', { name: 'تافل ۹۴ تا ۱۱۴' }));
    await screen.findByRole('heading', { name: 'برای سال اول چقدر می‌توانی خرج کنی؟' });
    await user.click(screen.getByRole('radio', { name: '۴ تا ۸ میلیارد' }));
    // £25,539 to £40,539 at 130,000 tomans: 3.3 to 5.3 billion.
    expect(
      await screen.findByText(/حدود (3.3|۳٫۳) تا (5.3|۵٫۳) میلیارد تومان/),
    ).toBeInTheDocument();
    expect(screen.getByText('با بودجه‌ات جور است')).toBeInTheDocument();
    expect(screen.getByText(/ویزای فارغ‌التحصیلی \(Graduate\)/)).toBeInTheDocument();
  });

  it('management lists the routes by country with their status', async () => {
    loginAs(AMIR);
    renderApp('/marketing/manage/pathways');
    expect(await screen.findByRole('heading', { name: 'آلمان' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /کار ماهر ۱۸۹.*منتظر بررسی/ })).toBeInTheDocument();
  });

  it('the editor shows requirements as musts joined by «و», alternatives by «یا»', async () => {
    loginAs(AMIR);
    const user = userEvent.setup();
    renderApp('/marketing/manage/pathways/2');
    // Canada: (a year of work or a job offer), English B2, at least 18.
    expect(await screen.findByText('شرط لازم ۳')).toBeInTheDocument();
    expect(screen.getAllByText('و')).toHaveLength(2);
    expect(screen.getAllByText('یا')).toHaveLength(1);
    const [, second] = screen.getAllByRole('button', { name: '+ یا (گزینه‌ی دیگری به جای این)' });
    if (second) await user.click(second);
    expect(screen.getAllByText('یا')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '+ شرط لازم دیگر' }));
    expect(screen.getByText('شرط لازم ۴')).toBeInTheDocument();
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
