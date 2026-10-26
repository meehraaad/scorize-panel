import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { accountOf } from '@/mocks/account';
import { estimateAnswers, estimateStarts } from '@/mocks/estimate';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { onDesktop } from '@/test/viewport';

// The quiz isn't on the server yet (src/lib/applicant/onServer.ts): switch everything on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const MARYAM = 2; // no contract (src/mocks/applicant.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const step = () => screen.getByRole('region', { name: /^(برای چه|سوابق|زبان|کجا|مشاور با شما)/ });
const next = () => screen.getByRole('button', { name: 'ادامه' });

/** Answers every step: Engineering, the given GPA and English choice, Italy, then contact. */
async function answerAll(
  user: ReturnType<typeof userEvent.setup>,
  {
    gpa = '17.5',
    english = /۷ و بالاتر/,
    channel = 'واتس‌اپ',
    time = 'امروز عصر',
    referral = '',
  } = {},
) {
  await screen.findByRole('heading', { name: 'برای چه می‌خواهید بروید؟' });
  await user.click(next());
  await user.selectOptions(screen.getByLabelText('رشته‌ی تحصیلی'), 'مهندسی');
  await user.type(screen.getByLabelText('معدل آخرین مقطع'), gpa);
  await user.click(next());
  await user.click(screen.getByRole('radio', { name: english }));
  await user.click(next());
  await user.click(screen.getByRole('checkbox', { name: 'ایتالیا' }));
  await user.click(next());
  await user.click(screen.getByRole('radio', { name: new RegExp(channel) }));
  if (channel !== 'فعلاً نه') await user.click(screen.getByRole('radio', { name: time }));
  if (referral) await user.click(screen.getByRole('radio', { name: referral }));
  await user.click(screen.getByRole('button', { name: 'دیدن شانس من' }));
}

describe('admission-chance quiz', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is the guest home: the quiz, then a short result linking to the full one', async () => {
    onDesktop();
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'سلام مریم، به اسکورایز خوش آمدید', level: 1 }),
    ).toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'تا اینجا' });
    expect(within(preview).getByRole('img', { name: 'پاسخ‌ها ۰٪ کامل' })).toBeInTheDocument();
    // First visit: the result's shape, locked, beside the first question.
    const locked = screen.getByRole('region', { name: 'نتیجه‌ی شما این شکلی است' });
    expect(within(locked).getByText(/بعد از سؤال آخر/)).toBeInTheDocument();
    // The rest of the guest home stays under it.
    expect(screen.getByRole('region', { name: 'پنل شما بعد از قرارداد' })).toBeInTheDocument();

    await answerAll(user);
    const best = await screen.findByRole('region', { name: 'بیشترین شانس شما: ایتالیا' });
    expect(within(best).getByText('بالا')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'جزئیات هر کشور' })).toHaveAttribute(
      'href',
      '/estimate',
    );
    const call = screen.getByRole('region', { name: 'مشاور شما تماس می‌گیرد' });
    expect(within(call).getByText('پاسخ‌های شما به تیم مشاوره رسید')).toBeInTheDocument();
    expect(
      within(call).getByText('یک مشاور امروز عصر در واتس‌اپ به شما پیام می‌دهد.'),
    ).toBeInTheDocument();
    // Short result: the per-country cards are on the full page.
    expect(screen.queryByRole('region', { name: 'ایتالیا' })).not.toBeInTheDocument();

    // The full result keeps the same promise instead of offering another call request.
    await user.click(screen.getByRole('link', { name: 'جزئیات هر کشور' }));
    expect(await screen.findByRole('region', { name: 'ایتالیا' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'مشاور شما تماس می‌گیرد' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'درخواست تماس مشاور' })).not.toBeInTheDocument();
  });

  it('on phones, the guest home asks in a sheet and keeps a short card', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/');
    const card = await screen.findByRole('region', { name: 'شانس پذیرش‌تان را ببینید' });
    // No preview or locked result filling the page: they live in the sheet's steps.
    expect(screen.queryByRole('region', { name: 'تا اینجا' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'نتیجه‌ی شما این شکلی است' })).toBeNull();
    expect(estimateStarts.has(MARYAM)).toBe(false);

    await user.click(within(card).getByRole('button', { name: 'شروع پرسش‌نامه' }));
    const sheet = screen.getByRole('dialog', { name: 'شانس پذیرش شما' });
    expect(within(sheet).getByRole('list', { name: 'مراحل پرسش‌نامه' })).toBeInTheDocument();
    await answerAll(user);

    // The sheet closes on the result: the best country, the call promise, the full result's link.
    const best = await screen.findByRole('region', { name: 'بیشترین شانس شما: ایتالیا' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      within(best).getByText('یک مشاور امروز عصر در واتس‌اپ به شما پیام می‌دهد.'),
    ).toBeInTheDocument();
    expect(within(best).getByRole('link', { name: 'جزئیات هر کشور' })).toHaveAttribute(
      'href',
      '/estimate',
    );
    expect(estimateStarts.has(MARYAM)).toBe(true);

    // Answering again opens the sheet; closing it keeps the result.
    await user.click(within(best).getByRole('button', { name: 'پاسخ دوباره' }));
    const again = screen.getByRole('dialog', { name: 'شانس پذیرش شما' });
    await user.click(within(again).getByRole('button', { name: 'بستن' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'بیشترین شانس شما: ایتالیا' })).toBeInTheDocument();
  });

  it('goes from the questions to the result and the call promise', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await answerAll(user);

    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    expect(
      screen.getByText('یک مشاور امروز عصر در واتس‌اپ به شما پیام می‌دهد.'),
    ).toBeInTheDocument();
    const italy = screen.getByRole('region', { name: 'ایتالیا' });
    expect(within(italy).getByText('بالا')).toBeInTheDocument();
    expect(within(italy).getByText(/University of Padova/)).toBeInTheDocument();
    // Levels only: no percentage while the server doesn't send one.
    expect(within(italy).queryByText(/٪/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'آلمان' })).not.toBeInTheDocument();

    expect(estimateStarts.has(MARYAM)).toBe(true);
    expect(estimateAnswers).toEqual([
      {
        goal: 'study',
        degree: 'master',
        field_group: 1,
        gpa: 17.5,
        english: { level: '7_plus' },
        budget: 'between_500m_1b',
        countries: [11],
        start: 'next_year',
        contact: { channel: 'whatsapp', time: 'evening' },
      },
    ]);
  });

  it('asks how they heard about Scorize on the last step, until answered', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await answerAll(user, { referral: 'اینستاگرام' });
    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    expect(estimateAnswers[0]?.referral).toBe('instagram');
    // The account's answer: the account page stops asking too.
    expect(accountOf(MARYAM).data.referral).toBe('instagram');

    // Answered: the next quiz doesn't ask again.
    await user.click(screen.getByRole('button', { name: 'پاسخ دوباره' }));
    for (let n = 0; n < 4; n++) await user.click(next());
    await screen.findByRole('heading', { name: 'مشاور با شما تماس بگیرد؟' });
    expect(
      screen.queryByRole('group', { name: 'از کجا با اسکورایز آشنا شدید؟' }),
    ).not.toBeInTheDocument();
  });

  it('checks a step before going on and shows the answers so far', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await screen.findByRole('heading', { name: 'برای چه می‌خواهید بروید؟' });
    await user.click(screen.getByRole('radio', { name: /کار یا زندگی/ }));
    await user.click(next());

    await user.click(next());
    expect(screen.getByLabelText('رشته‌ی تحصیلی')).toHaveFocus();
    expect(screen.getByLabelText('رشته‌ی تحصیلی')).toHaveAccessibleDescription(
      'یکی را انتخاب کنید.',
    );
    await user.selectOptions(screen.getByLabelText('رشته‌ی تحصیلی'), 'مهندسی');
    await user.type(screen.getByLabelText('معدل آخرین مقطع'), 'abc');
    await user.click(next());
    expect(screen.getByLabelText('معدل آخرین مقطع')).toHaveFocus();
    await user.clear(screen.getByLabelText('معدل آخرین مقطع'));
    await user.type(screen.getByLabelText('معدل آخرین مقطع'), '۱۸');

    const summary = screen.getByRole('region', { name: 'تا اینجا' });
    expect(within(summary).getByText('کار یا زندگی')).toBeInTheDocument();
    expect(within(summary).getByText('مهندسی')).toBeInTheDocument();
    expect(within(summary).getByText('۱۸ از ۲۰')).toBeInTheDocument();

    await user.click(next());
    await user.click(screen.getByRole('radio', { name: /مدرک زبان دارم/ }));
    await user.selectOptions(screen.getByLabelText('آزمون'), 'تافل');
    await user.type(screen.getByLabelText('نمره'), '130');
    await user.click(next());
    expect(screen.getByLabelText('نمره')).toHaveAccessibleDescription(
      'نمره باید بین ۰ و ۱۲۰ باشد.',
    );
    expect(step()).toHaveAccessibleName('زبان انگلیسی');
  });

  it('takes the GPA out of 4 or 100 and sends it out of 20', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await screen.findByRole('heading', { name: 'برای چه می‌خواهید بروید؟' });
    await user.click(next());
    await user.selectOptions(screen.getByLabelText('رشته‌ی تحصیلی'), 'مهندسی');
    const gpa = screen.getByLabelText('معدل آخرین مقطع');
    expect(gpa).toHaveAccessibleDescription('معدل از ۲۰، مثلاً ۱۷٫۵.');
    await user.click(screen.getByRole('radio', { name: 'از ۴' }));
    expect(gpa).toHaveAccessibleDescription('معدل از ۴، مثلاً ۳٫۵.');
    await user.type(gpa, '17');
    await user.click(next());
    expect(gpa).toHaveAccessibleDescription('معدل از ۴ را به عدد بنویسید، مثلاً ۳٫۵.');
    await user.clear(gpa);
    await user.type(gpa, '3.6');
    expect(
      within(screen.getByRole('region', { name: 'تا اینجا' })).getByText('۳٫۶ از ۴'),
    ).toBeInTheDocument();
    await user.click(next());
    await user.click(next());
    await user.click(next());
    await user.click(screen.getByRole('radio', { name: /فعلاً نه/ }));
    await user.click(screen.getByRole('button', { name: 'دیدن شانس من' }));
    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    expect(estimateAnswers[0]?.gpa).toBe(18);
  });

  it('without contact: no call promise, a call they can ask for instead', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await answerAll(user, { gpa: '12', english: /^مدرک ندارم/, channel: 'فعلاً نه' });

    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    expect(
      screen.queryByRole('region', { name: 'مشاور شما تماس می‌گیرد' }),
    ).not.toBeInTheDocument();
    const call = screen.getByRole('region', { name: 'یک تماس کوتاه رایگان' });
    expect(within(call).getByRole('button', { name: 'درخواست تماس مشاور' })).toBeInTheDocument();
    const italy = screen.getByRole('region', { name: 'ایتالیا' });
    expect(within(italy).getByText('با آیلتس ۷: از «پایین» به «متوسط»')).toBeInTheDocument();
    expect(estimateAnswers[0]?.contact).toEqual({ channel: 'none' });
  });

  it('shows the last result on return, then lets them answer again', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await answerAll(user);
    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    cleanup();

    renderApp('/estimate');
    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    expect(
      screen.queryByRole('region', { name: 'مشاور شما تماس می‌گیرد' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'پاسخ دوباره' }));
    expect(
      await screen.findByRole('heading', { name: 'برای چه می‌خواهید بروید؟' }),
    ).toBeInTheDocument();

    cleanup();
    renderApp('/');
    const best = await screen.findByRole('region', { name: 'بیشترین شانس شما: ایتالیا' });
    expect(within(best).getByText('بالا')).toBeInTheDocument();
  });

  it('starts again from the answers the profile holds', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await screen.findByRole('heading', { name: 'برای چه می‌خواهید بروید؟' });
    cleanup();

    renderApp('/estimate');
    await answerAll(user);
    await user.click(await screen.findByRole('button', { name: 'پاسخ دوباره' }));
    await screen.findByRole('heading', { name: 'برای چه می‌خواهید بروید؟' });
    await user.click(next());
    expect(screen.getByLabelText('رشته‌ی تحصیلی')).toHaveValue('1');
    expect(screen.getByLabelText('معدل آخرین مقطع')).toHaveValue('17.5');
    await user.click(next());
    expect(screen.getByRole('radio', { name: /۷ و بالاتر/ })).toBeChecked();
    await user.click(next());
    expect(screen.getByRole('checkbox', { name: 'ایتالیا' })).toBeChecked();
  });
});
