import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { MOCK_PLEDGE_CODE } from '@/mocks/applicant';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const MARYAM = 2; // no contract: may start the free Turkey application (src/mocks/applicant.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const pdf = (name: string) => new File([new Uint8Array(1024)], name, { type: 'application/pdf' });
const docs = () => screen.getByRole('region', { name: 'مدارک ترکیه' });
const row = (name: string) => {
  const item = within(docs())
    .getAllByRole('listitem')
    .find((candidate) => candidate.textContent.includes(name));
  if (!item) throw new Error(`No document row ${name}`);
  return item;
};

describe('free Turkey application', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is offered on the guest home', async () => {
    loginAs(MARYAM);
    renderApp('/');
    const card = await screen.findByRole('region', { name: 'اپلای رایگان ترکیه' });
    expect(within(card).getByRole('link', { name: 'شروع اپلای ترکیه' })).toHaveAttribute(
      'href',
      '/turkey',
    );
  });

  it('goes from the questions to a started case', async () => {
    const user = userEvent.setup({ applyAccept: false });
    loginAs(MARYAM);
    renderApp('/turkey');

    // 1. Questions.
    await screen.findByRole('heading', {
      name: 'در دانشگاه‌های ترکیه اپلای کنید، بدون هزینه‌ی خدمات',
      level: 1,
    });
    await user.click(screen.getByRole('button', { name: 'ادامه: آپلود مدارک' }));
    expect(screen.getByLabelText('رشته‌ی مورد نظر')).toHaveFocus();
    expect(screen.getByLabelText('رشته‌ی مورد نظر')).toHaveAccessibleDescription(
      'این خانه را پر کنید.',
    );
    await user.type(screen.getByLabelText('رشته‌ی مورد نظر'), 'مهندسی کامپیوتر');
    await user.type(screen.getByLabelText('معدل آخرین مقطع'), '۲۵');
    await user.type(screen.getByLabelText('زمان شروع تحصیل'), 'پاییز ۲۰۲۷');
    await user.click(screen.getByRole('button', { name: 'ادامه: آپلود مدارک' }));
    expect(screen.getByLabelText('معدل آخرین مقطع')).toHaveAccessibleDescription(
      'معدل را عددی بین ۰ و ۲۰ بنویسید.',
    );
    await user.clear(screen.getByLabelText('معدل آخرین مقطع'));
    await user.type(screen.getByLabelText('معدل آخرین مقطع'), '۱۷٫۲۵');
    await user.click(screen.getByRole('button', { name: 'ادامه: آپلود مدارک' }));

    // 2. Documents for a master's degree.
    expect(
      await screen.findByRole('heading', { name: 'مدارک ترکیه را آپلود کنید', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('فهرست زیر برای مقطع کارشناسی ارشد است.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ارسال برای بررسی' }));
    expect(within(docs()).getByRole('alert')).toHaveTextContent(
      'اول همه‌ی مدارک لازم را آپلود کنید.',
    );

    const passport = within(row('پاسپورت')).getByLabelText('آپلود پاسپورت');
    await user.upload(passport, new File(['x'], 'p.docx', { type: 'application/msword' }));
    expect(passport).toHaveAccessibleDescription(/این نوع فایل پذیرفته نمی‌شود/);

    for (const [name, file] of [
      ['پاسپورت', 'passport.pdf'],
      ['دانشنامه‌ی کارشناسی (ترجمه‌ی رسمی)', 'degree.pdf'],
      ['ریز نمرات کارشناسی (ترجمه‌ی رسمی)', 'transcript.pdf'],
      ['عکس پرسنلی', 'photo.pdf'],
    ] as const) {
      await user.upload(within(row(name)).getByLabelText(`آپلود ${name}`), pdf(file));
      expect(await within(row(name)).findByText(`آپلود شد · ${file}`)).toBeInTheDocument();
    }
    expect(within(docs()).getByText('۴ از ۴')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ارسال برای بررسی' }));

    // 3. The team sends the transcript back.
    expect(
      await screen.findByRole('heading', { name: 'مدارک شما در حال بررسی است', level: 1 }),
    ).toBeInTheDocument();
    const transcript = row('ریز نمرات کارشناسی');
    expect(transcript).toHaveTextContent('نیاز به آپلود دوباره');
    expect(transcript).toHaveTextContent('صفحه‌ی دوم ریز نمرات در فایل نبود');
    expect(row('پاسپورت')).toHaveTextContent('تأیید شد');
    expect(within(row('پاسپورت')).queryByLabelText('آپلود پاسپورت')).toBeNull();
    await user.upload(
      within(transcript).getByLabelText('آپلود ریز نمرات کارشناسی (ترجمه‌ی رسمی)'),
      pdf('transcript-all-pages.pdf'),
    );
    await user.click(await screen.findByRole('button', { name: 'ارسال دوباره' }));

    // 4. The pledge, signed with an SMS code.
    expect(
      await screen.findByRole('heading', { name: 'تعهدنامه‌ی اپلای رایگان ترکیه', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'متن تعهدنامه' })).toHaveTextContent(
      '۱. موضوع قرارداد',
    );
    await user.click(screen.getByRole('button', { name: /^ارسال کد تأیید به/ }));
    const code = await screen.findByLabelText(/^کد تأیید پیامک‌شده به/);
    expect(screen.getByText(/ارسال دوباره‌ی کد تا/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'امضا و شروع پرونده' }));
    expect(screen.getByRole('alert')).toHaveTextContent('اول تأیید کنید که متن را خوانده‌اید.');
    await user.click(screen.getByLabelText('متن تعهدنامه را خواندم و می‌پذیرم.'));

    await user.type(code, '۱۱۱۱۱');
    await user.click(screen.getByRole('button', { name: 'امضا و شروع پرونده' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('کد درست نیست یا منقضی شده');

    await user.clear(code);
    await user.type(code, MOCK_PLEDGE_CODE);
    await user.click(screen.getByRole('button', { name: 'امضا و شروع پرونده' }));

    // 5. Started.
    expect(
      await screen.findByRole('heading', { name: 'پرونده‌ی ترکیه‌ی شما شروع شد', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رفتن به پرونده‌ی من' })).toHaveAttribute('href', '/');
    const bar = screen.getByRole('list', { name: 'مراحل اپلای ترکیه' });
    expect(within(bar).getAllByRole('listitem')).toHaveLength(4);
  });
});
