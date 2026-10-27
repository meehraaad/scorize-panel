import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { estimateAnswers } from '@/mocks/estimate';
import type { ApplicationsData } from './api';

// Also covers features Django doesn't serve yet (src/lib/applicant/onServer.ts): switch them on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const SARA = 1; // applicant with 12 applications (src/mocks/applicant.ts)
const MARYAM = 2; // no applicant file

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const openPage = async () => {
  loginAs(SARA);
  renderApp('/applications');
  await screen.findByRole('heading', { name: 'اپلای‌ها و نتایج', level: 1 });
};

const region = (name: string) => screen.getByRole('region', { name });
const awaiting = () => region('منتظر تأیید شما');
const lane = (name: string) => region(name);
const titlesIn = (element: HTMLElement) =>
  within(element)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('bdi')?.textContent);

describe('applications page', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('shows the quota, what waits for approval, the three columns, visa and professor emails', async () => {
    await openPage();
    const quota = region('۱۲ دانشگاه ثبت شده، از ۱۵ اپلای قرارداد');
    expect(quota).toHaveTextContent('مرحله‌ی پرونده:در حال اپلای');
    const legend = within(quota).getByRole('list', { name: 'وضعیت اپلای‌ها' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '۳ نتیجه آمد',
      '۱ ارسال شد',
      '۵ در حال آماده‌سازی',
      '۲ منتظر تأیید شما',
      '۱ را رد کردید',
      '۳ هنوز انتخاب نشده',
    ]);

    expect(titlesIn(awaiting())).toEqual(['McGill University', 'University of Waterloo']);
    expect(within(awaiting()).getAllByText('کانادا')).toHaveLength(2);

    // Each column by deadline; each card keeps its exact status.
    expect(titlesIn(lane('در حال آماده‌سازی'))).toEqual([
      'RWTH Aachen',
      'University of Toronto',
      'Simon Fraser University',
      'University of Alberta',
      'Concordia University',
    ]);
    expect(within(lane('در حال آماده‌سازی')).getByText('مدارک ناقص است')).toBeInTheDocument();
    expect(titlesIn(lane('ارسال شد، منتظر نتیجه'))).toEqual(['UBC']);
    expect(titlesIn(lane('نتیجه آمد'))).toEqual([
      'TU Berlin',
      'TU Munich',
      'University of Edinburgh',
    ]);
    expect(within(lane('نتیجه آمد')).getAllByText(/^نتیجه [۰-۹]/)).toHaveLength(3);

    expect(region('نتایج ویزا')).toHaveTextContent('منتظر برگزاری جلسه‌ی سفارت');
    expect(
      await within(region('ایمیل به استادها')).findByText('صفحه‌ی ۱ از ۱۸'),
    ).toBeInTheDocument();
  });

  it('approves, and rejects after a confirmation', async () => {
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: 'تأیید اپلای McGill University' }));
    await waitFor(() => {
      expect(titlesIn(awaiting())).toEqual(['University of Waterloo']);
    });
    expect(titlesIn(lane('در حال آماده‌سازی'))).toContain('McGill University');

    await user.click(screen.getByRole('button', { name: 'رد اپلای University of Waterloo' }));
    await user.click(screen.getByRole('button', { name: 'رد اپلای' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'منتظر تأیید شما' })).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '۲ پیشنهاد را رد کرده‌اید · نمایش' }));
    expect(titlesIn(screen.getByRole('list', { name: 'پیشنهادهای ردشده' }))).toEqual([
      'University of Ottawa',
      'University of Waterloo',
    ]);
  });

  it('links a missing document to the documents tab, with the supervisor note', async () => {
    const user = userEvent.setup();
    await openPage();
    const preparing = lane('در حال آماده‌سازی');
    expect(within(preparing).getByText(/ریز نمرات با ترجمه‌ی رسمی لازم است/)).toBeInTheDocument();
    await user.click(within(preparing).getByRole('link', { name: 'رفتن به مدارک' }));
    expect(
      await screen.findByRole('heading', { name: 'مدارک و نگارش', level: 1 }),
    ).toBeInTheDocument();
  });

  it('shows the supervisor note on request', async () => {
    const user = userEvent.setup();
    await openPage();
    const preparing = lane('در حال آماده‌سازی');
    const toggle = within(preparing).getByRole('button', { name: 'توضیح سوپروایزر' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(within(preparing).getByText(/یکی از دو توصیه‌نامه هنوز ارسال نشده/)).toBeInTheDocument();
  });

  it('congratulates on a new admission and asks once about showing it', async () => {
    const user = userEvent.setup();
    await openPage();
    const card = region('تبریک! از ⁨TU Munich⁩ پذیرش گرفتید');
    expect(card).toHaveTextContent('مهلت قبول پیشنهاد ۱۵ آذر است');
    await user.click(within(card).getByRole('button', { name: 'بله، اجازه می‌دهم' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /پذیرش گرفتید/ })).not.toBeInTheDocument();
    });
  });

  it('shows where the case is when no application is added yet', async () => {
    server.use(
      http.get('/api/applicant/v1/applications/', () =>
        HttpResponse.json<ApplicationsData>({
          stage: 'documents',
          applies: { used: 0, total: 10 },
          results: [],
          visa: null,
        }),
      ),
    );
    await openPage();
    const stage = region('الان در مرحله‌ی «جمع‌آوری مدارک» هستید');
    expect(stage).toHaveTextContent('قرارداد شما ۱۰ اپلای دارد');
    expect(within(stage).getByRole('list', { name: 'مراحل پرونده' })).toBeInTheDocument();
    const next = region('چیزی که اپلای را جلو می‌اندازد');
    expect(within(next).getByRole('link', { name: /پیام به سوپروایزر/ })).toHaveAttribute(
      'href',
      '/tickets/supervisor',
    );
    expect(region('این صفحه چطور کار می‌کند')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'اپلای‌های تأییدشده' })).not.toBeInTheDocument();
  });

  it('sells the service to someone without a contract, without sample data', async () => {
    loginAs(MARYAM);
    renderApp('/applications');
    const hero = await screen.findByRole('region', {
      name: 'هر دانشگاه را شما تأیید می‌کنید. فرستادن و پیگیری با ما.',
    });
    expect(within(hero).getByRole('link', { name: 'رزرو مشاوره' })).toHaveAttribute(
      'href',
      '/consultations/book',
    );
    expect(screen.queryByRole('region', { name: 'این بخش قفل است' })).not.toBeInTheDocument();
    expect(screen.queryByText('University of Toronto')).not.toBeInTheDocument();
    expect(region('از پیشنهاد تا نتیجه، همه در همین صفحه')).toBeInTheDocument();
  });

  it('asks what the chance reads beside it and saves the answers as the quiz does', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/applications');
    const chance = await screen.findByRole('region', { name: 'شانس پذیرش شما در هر کشور' });
    expect(chance).toHaveTextContent('با پاسخ‌ها، شانس شما در هر کشور این‌جا می‌آید');
    expect(within(chance).getByRole('button', { name: '۲ مورد دیگر مانده' })).toBeEnabled();

    await user.selectOptions(within(chance).getByLabelText('رشته‌ی تحصیلی'), 'مهندسی');
    await user.type(within(chance).getByLabelText('معدل آخرین مقطع'), '18');
    await user.click(within(chance).getByRole('button', { name: 'دیدن شانس من' }));

    await waitFor(() => expect(estimateAnswers).toHaveLength(1));
    // This tab's answers: study, and no call asked for.
    expect(estimateAnswers[0]).toMatchObject({
      goal: 'study',
      field_group: 1,
      gpa: 18,
      contact: { channel: 'none' },
    });
    expect(
      await within(chance).findByRole('heading', { name: 'چرا آلمان؟' }),
    ).toBeInTheDocument();
    expect(within(chance).getByRole('button', { name: 'شانس به‌روز است' })).toBeDisabled();

    await user.click(within(chance).getByRole('button', { name: /ایتالیا/ }));
    expect(within(chance).getByRole('heading', { name: 'چرا ایتالیا؟' })).toBeInTheDocument();
    expect(chance).toHaveTextContent('هنوز پذیرشی با سوابق شبیه شما در این کشور ثبت نشده.');

    // A changed answer marks the result as stale until it's sent again.
    await user.click(within(chance).getByRole('radio', { name: 'دکترا' }));
    expect(chance).toHaveTextContent('پاسخ‌ها عوض شده، به‌روزرسانی کنید');
    expect(within(chance).getByRole('button', { name: 'به‌روزرسانی شانس' })).toBeEnabled();
  });

  it('keeps research interests before a contract and shows the professors on them', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/applications');
    const interests = await screen.findByRole('region', {
      name: 'دوست دارید روی چه موضوعی پژوهش کنید؟',
    });
    await user.type(within(interests).getByLabelText('افزودن علاقه‌ی پژوهشی'), 'Robotics');
    await user.click(within(interests).getByRole('button', { name: 'ثبت' }));
    const professors = region('استادهای هم‌موضوع با شما');
    await waitFor(() => expect(professors).toHaveTextContent('۷۴'));
    expect(professors).toHaveTextContent('استاد در ۹ دانشگاه');
  });

  it('keeps the case’s research interests on the page, next to the nearest deadline', async () => {
    const user = userEvent.setup();
    await openPage();
    const interests = region('علاقه‌های پژوهشی');
    expect(interests).toHaveTextContent('Machine Learning');
    await user.type(within(interests).getByLabelText('افزودن علاقه‌ی پژوهشی'), 'machine learning');
    await user.click(within(interests).getByRole('button', { name: 'ثبت' }));
    expect(interests).toHaveTextContent(/از قبل در فهرست هست/);
  });
});
