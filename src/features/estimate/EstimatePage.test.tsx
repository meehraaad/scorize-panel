import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { estimateAnswers, estimateStarts } from '@/mocks/estimate';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

// The quiz isn't on the server yet (src/lib/applicant/onServer.ts): switch everything on.
vi.mock('@/lib/applicant/onServer', async (original) => {
  const { ON_SERVER } = await original<{ ON_SERVER: Record<string, boolean> }>();
  return { ON_SERVER: Object.fromEntries(Object.keys(ON_SERVER).map((key) => [key, true])) };
});

const MARYAM = 2; // no contract (src/mocks/applicant.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

const step = () => screen.getByRole('region', { name: /سؤال|برای چه|سوابق|زبان|کجا|مشاور/ });
const next = () => screen.getByRole('button', { name: 'ادامه' });

/** Answers every step: Engineering, the given GPA and English choice, Italy, then contact. */
async function answerAll(
  user: ReturnType<typeof userEvent.setup>,
  { gpa = '17.5', english = '۷ و بالاتر', channel = 'واتس‌اپ', time = 'امروز عصر' } = {},
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
  await user.click(screen.getByRole('button', { name: 'دیدن شانس من' }));
}

describe('admission-chance quiz', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('is offered on the guest home', async () => {
    loginAs(MARYAM);
    renderApp('/');
    const card = await screen.findByRole('region', { name: 'شانس پذیرش‌تان چقدر است؟' });
    expect(within(card).getByRole('link', { name: 'شروع پرسش‌نامه' })).toHaveAttribute(
      'href',
      '/estimate',
    );
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
    expect(within(summary).getByText('۱۸')).toBeInTheDocument();

    await user.click(next());
    await user.click(screen.getByRole('radio', { name: 'نمره‌ی آزمون دارم' }));
    await user.selectOptions(screen.getByLabelText('آزمون'), 'تافل');
    await user.type(screen.getByLabelText('نمره'), '130');
    await user.click(next());
    expect(screen.getByLabelText('نمره')).toHaveAccessibleDescription(
      'نمره باید بین ۰ و ۱۲۰ باشد.',
    );
    expect(step()).toHaveAccessibleName('زبان انگلیسی');
  });

  it('without contact: no call promise, a consultation link instead', async () => {
    const user = userEvent.setup();
    loginAs(MARYAM);
    renderApp('/estimate');
    await answerAll(user, { gpa: '12', english: 'مدرک ندارم', channel: 'فعلاً نه' });

    await screen.findByRole('heading', { name: 'شانس پذیرش شما', level: 1 });
    expect(
      screen.queryByRole('region', { name: 'مشاور شما تماس می‌گیرد' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رزرو مشاوره' })).toBeInTheDocument();
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
    const card = await screen.findByRole('region', { name: 'آخرین نتیجه‌ی شانس پذیرش شما' });
    expect(within(card).getByText('ایتالیا: بالا')).toBeInTheDocument();
  });
});
