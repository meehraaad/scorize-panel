import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { MOCK_PLEDGE_CODE } from '@/mocks/applicant';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// Turkey isn't on the server yet (src/lib/applicant/onServer.ts): switch it on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const MARYAM = 2; // no contract (src/mocks/applicant.ts)

const pdf = (name: string) => new File([new Uint8Array(1024)], name, { type: 'application/pdf' });
const status = () => screen.getByRole('region', { name: 'مدارک شما برای ترکیه در حال بررسی است.' });

describe('documents tab that starts Turkey', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(MARYAM));
    await i18n.changeLanguage('fa');
  });

  it('goes from the first upload to the SMS signature', async () => {
    const user = userEvent.setup();
    const router = renderApp('/documents');

    // Before the questions: the list depends on the degree.
    const hero = await screen.findByRole('region', {
      name: 'با آپلود همین مدارک، اپلای ترکیه‌تان شروع می‌شود.',
    });
    expect(within(hero).getAllByRole('listitem')).toHaveLength(3);
    await user.click(within(hero).getByRole('link', { name: 'شروع اپلای ترکیه' }));
    await user.type(await screen.findByLabelText('رشته‌ی مورد نظر'), 'مهندسی کامپیوتر');
    await user.type(screen.getByLabelText('معدل آخرین مقطع'), '17.25');
    await user.type(screen.getByLabelText('زمان شروع تحصیل'), 'پاییز ۲۰۲۷');
    await user.click(screen.getByRole('button', { name: 'ادامه: آپلود مدارک' }));
    await screen.findByRole('heading', { name: 'مدارک ترکیه را آپلود کنید', level: 1 });
    await router.navigate('/documents');

    // The list holds Turkey's documents, tagged, then the texts.
    const list = await screen.findByRole('region', { name: 'مدارک شما' });
    expect(within(list).getAllByText(/لازم برای ترکیه/)).toHaveLength(4);
    expect(
      within(list).getByText('۴ مدرک لازم دیگر مانده. هر مدرک همان لحظه‌ی آپلود بررسی می‌شود.'),
    ).toBeInTheDocument();
    expect(
      within(list).getByRole('button', { name: 'سفارش نگارش انگیزه‌نامه' }),
    ).toBeInTheDocument();

    // The first upload: the status takes the hero's place.
    const start = screen.getByRole('region', {
      name: 'با آپلود همین مدارک، اپلای ترکیه‌تان شروع می‌شود.',
    });
    expect(within(start).getByText('مدرک بعدی: پاسپورت')).toBeInTheDocument();
    await user.upload(within(start).getByLabelText('آپلود پاسپورت'), pdf('passport.pdf'));
    const review = await screen.findByRole('region', {
      name: 'مدارک شما برای ترکیه در حال بررسی است.',
    });
    const docs = within(review).getByRole('list', { name: 'وضعیت هر مدرک' });
    expect(within(docs).getByText('پاسپورت').parentElement).toHaveTextContent('تأیید شد');
    expect(within(review).getByRole('list', { name: 'مراحل ترکیه' })).toHaveTextContent(
      '۱ از ۴ تأیید شد',
    );

    // The status card asks for the next document.
    const next = async (name: string) => {
      const input = await within(status()).findByLabelText(`آپلود ${name}`);
      await user.upload(input, pdf('file.pdf'));
    };
    await next('دانشنامه‌ی کارشناسی (ترجمه‌ی رسمی)');
    await next('ریز نمرات کارشناسی (ترجمه‌ی رسمی)');

    // The team sends the transcript back.
    const fix = await screen.findByRole('region', {
      name: 'ریز نمرات کارشناسی (ترجمه‌ی رسمی) را دوباره آپلود کنید.',
    });
    expect(fix).toHaveTextContent('صفحه‌ی دوم ریز نمرات در فایل نبود');
    expect(within(fix).getByRole('list', { name: 'مراحل ترکیه' })).toHaveTextContent(
      '۲ از ۴ تأیید شد',
    );
    await user.upload(
      within(fix).getByLabelText('آپلود ریز نمرات کارشناسی (ترجمه‌ی رسمی)'),
      pdf('transcript-all-pages.pdf'),
    );
    await screen.findByRole('region', { name: 'مدارک شما برای ترکیه در حال بررسی است.' });
    await next('عکس پرسنلی');

    // All approved: the pledge's summary and the SMS signature, here.
    const sign = await screen.findByRole('region', {
      name: 'تعهدنامه را امضا کنید تا پرونده‌ی ترکیه همین حالا شروع شود.',
    });
    expect(within(sign).getByText('رایگان')).toBeInTheDocument();
    await user.click(within(sign).getByText('خواندن متن کامل تعهدنامه'));
    expect(within(sign).getByRole('region', { name: 'متن تعهدنامه' })).toHaveTextContent(
      '۱. موضوع قرارداد',
    );
    await user.click(within(sign).getByLabelText('متن تعهدنامه را خواندم و می‌پذیرم.'));
    await user.click(within(sign).getByRole('button', { name: /^ارسال کد تأیید به/ }));
    await user.type(await within(sign).findByLabelText(/^کد تأیید پیامک‌شده به/), MOCK_PLEDGE_CODE);
    await user.click(within(sign).getByRole('button', { name: 'امضا و شروع پرونده' }));

    expect(
      await screen.findByRole('heading', { name: 'پرونده‌ی ترکیه‌ی شما شروع شد.' }),
    ).toBeInTheDocument();
  });
});
