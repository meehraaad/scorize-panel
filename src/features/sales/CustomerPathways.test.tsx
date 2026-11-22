import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { setCustomerPathwayCheck } from '@/mocks/pathways';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // a seller
const ERFAN = 105; // one of Nima's customers
const TITLE = 'مسیرهای مهاجرت';

function withCheck() {
  setCustomerPathwayCheck(ERFAN, {
    id: 1,
    created_at: '2026-11-20T10:00:00+03:30',
    answers: [
      { factor: 'age', value: 31, profile: 31, matches: true },
      { factor: 'education', value: 'master', profile: 'master', matches: true },
      { factor: 'english_ielts', value: 7.5, profile: 6.5, matches: false },
      { factor: 'gpa', value: 17, profile: null, matches: null },
    ],
    by_country: [{ country: 'آلمان', answers: [{ factor: 'job_offer', value: true }] }],
    field_group: 'مهندسی',
    occupation: { code: '2142', name: 'مهندسان عمران' },
    budget: '1b_2b',
    insights: {
      degree: 2,
      gpa: 17,
      gpa_from: 'quiz',
      english_ielts: 7.5,
      countries: [
        {
          country: 'ایتالیا',
          code: 'IT',
          band: 'high',
          chance: null,
          decided: 60,
          similar: [{ university: 'University of Padova', field: 'مهندسی', year: 2025 }],
        },
        { country: 'آلمان', code: 'DE', band: 'medium', chance: 54, decided: 30, similar: [] },
      ],
    },
    results: [
      {
        country: 'آلمان',
        code: 'DE',
        pathway: 'کارت فرصت',
        goal: 'work',
        qualifies: true,
        eligible: true,
        points: 8,
        pass_mark: 6,
        max_points: 14,
        missing: [],
        scores: [{ label: 'مدرک', points: 4, max_points: 4 }],
        improvements: [],
      },
      {
        country: 'انگلیس',
        code: 'GB',
        pathway: 'ویزای تحصیلی',
        goal: 'study',
        qualifies: true,
        eligible: true,
        points: 0,
        pass_mark: null,
        missing: [],
        admission: { band: 'high', chance: null, decided: 60, universities: ['Leeds'] },
        study: { first_year_toman: { min: 3_300_000_000, max: 5_300_000_000 }, budget_fit: 'fits' },
      },
      {
        country: 'کانادا',
        code: 'CA',
        pathway: 'اکسپرس انتری',
        goal: 'work',
        qualifies: false,
        eligible: true,
        points: 61,
        pass_mark: 67,
        max_points: 100,
        missing: [],
        improvements: [{ label: 'آیلتس ۷', points: 10, passes: true }],
      },
    ],
  });
}

describe("sales customer page: the customer's pathway quiz", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  it('leads with the best route, then every route and what to say on the call', async () => {
    withCheck();
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const card = await screen.findByRole('region', { name: TITLE });
    expect(within(card).getByText('بهترین گزینه برای این مشتری')).toBeInTheDocument();
    expect(within(card).getByText('۲ امتیاز بیشتر از حد قبولی.')).toBeInTheDocument();
    // Two of three fit, Canada is close, the UK has the best chance.
    expect(within(card).getByText('مسیرهای مناسب').nextSibling).toHaveTextContent('۲ از ۳');
    expect(within(card).getByText('نزدیک به قبولی').nextSibling).toHaveTextContent('۱ کانادا');
    const routes = within(card).getByRole('list', { name: 'همه‌ی مسیرها' });
    // The first route is open: its points.
    expect(within(routes).getByText('مدرک ۴')).toBeInTheDocument();
    await user.click(within(routes).getByRole('button', { name: /انگلیس/ }));
    expect(
      within(routes).getByText('بر اساس ۶۰ متقاضی اسکورایز با سوابق نزدیک'),
    ).toBeInTheDocument();
    expect(within(routes).getByText('با بودجه‌اش جور است')).toBeInTheDocument();
    expect(within(routes).getByText('نزدیک')).toBeInTheDocument();
    expect(within(card).getByText(/کانادا با «آیلتس ۷» قبول می‌شود/)).toBeInTheDocument();
  });

  it('shows the answers beside what the profile says', async () => {
    withCheck();
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const card = await screen.findByRole('region', { name: TITLE });
    await user.click(within(card).getByRole('radio', { name: 'پاسخ‌ها' }));
    expect(within(card).getByText('۱ پاسخ با پرونده فرق دارد')).toBeInTheDocument();
    expect(within(card).getByText('آیلتس ۷ تا ۸')).toBeInTheDocument();
    expect(within(card).getByText('در پرونده: آیلتس ۶٫۵')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'ویرایش پرونده' })).toHaveAttribute(
      'href',
      `/sales/customers/${String(ERFAN)}/info`,
    );
    expect(within(card).getAllByText('مثل پرونده')).toHaveLength(2);
    expect(within(card).getByText('۱۶ تا ۱۸')).toBeInTheDocument();
    expect(within(card).getByText('مهندسان عمران')).toBeInTheDocument();
    expect(within(card).getByText('پیشنهاد کار: بله')).toBeInTheDocument();
  });

  it("shows the chance of admission per country from Scorize's outcomes", async () => {
    withCheck();
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const card = await screen.findByRole('region', { name: TITLE });
    // The best chance is the insights' first country.
    expect(within(card).getByText('بهترین شانس پذیرش').nextSibling).toHaveTextContent(
      'بالا ایتالیا',
    );
    await user.click(within(card).getByRole('radio', { name: 'شانس پذیرش' }));
    const list = within(card).getByRole('list', { name: 'شانس پذیرش در هر کشور' });
    expect(within(card).getByText('برای کارشناسی ارشد · معدل ۱۷')).toBeInTheDocument();
    expect(within(list).getByText('شانس پذیرش بالا')).toBeInTheDocument();
    expect(within(list).getByText('شانس حدود ۵۴٪')).toBeInTheDocument();
    expect(within(list).getByText('بر اساس ۶۰ متقاضی اسکورایز با سوابق نزدیک')).toBeInTheDocument();
    expect(within(list).getByText(/University of Padova · مهندسی/)).toBeInTheDocument();
  });

  it('has no card for a customer who never took the quiz', async () => {
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: TITLE })).not.toBeInTheDocument();
  });
});
