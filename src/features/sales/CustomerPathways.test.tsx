import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { setCustomerPathwayCheck } from '@/mocks/pathways';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // a seller
const ERFAN = 105; // one of Nima's customers
const TITLE = 'نتیجه‌ی آزمون مسیر کار و اقامت';

describe("sales customer page: the customer's pathway quiz", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', String(NIMA));
  });

  it('shows the latest quiz as answered, each route with its verdict', async () => {
    setCustomerPathwayCheck(ERFAN, {
      id: 1,
      created_at: '2026-11-20T10:00:00+03:30',
      answers: [
        { factor: 'age', value: 31 },
        { factor: 'education', value: 'master' },
        { factor: 'skills_assessment', value: false },
      ],
      by_country: [{ country: 'آلمان', answers: [{ factor: 'job_offer', value: true }] }],
      field_group: 'مهندسی',
      occupation: { code: '2142', name: 'مهندسان عمران' },
      budget: '1b_2b',
      gpa: 17,
      results: [
        {
          country: 'آلمان',
          pathway: 'کارت فرصت',
          goal: 'work',
          qualifies: true,
          eligible: true,
          points: 8,
          pass_mark: 6,
          missing: [],
          admission: { band: 'high', chance: null },
        },
        {
          country: 'کانادا',
          pathway: 'اکسپرس انتری',
          goal: 'work',
          qualifies: false,
          eligible: false,
          points: 0,
          pass_mark: 67,
          missing: ['IELTS 6'],
        },
      ],
    });
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const card = await screen.findByRole('region', { name: TITLE });
    const routes = within(card).getByRole('list', { name: 'مسیرها' });
    expect(within(routes).getByText('آلمان · کارت فرصت')).toBeInTheDocument();
    expect(within(routes).getByText('شرایط دارد')).toBeInTheDocument();
    expect(within(routes).getByText('۸ از ۶ امتیاز')).toBeInTheDocument();
    expect(within(routes).getByText('کم دارد: IELTS 6')).toBeInTheDocument();
    expect(within(card).getByText('ارشد')).toBeInTheDocument();
    expect(within(card).getByText('مهندسان عمران')).toBeInTheDocument();
    expect(within(card).getByText('۱ تا ۲ میلیارد')).toBeInTheDocument();
    expect(within(card).getByText('پیشنهاد کار: بله')).toBeInTheDocument();
    expect(within(routes).getByText('شانس پذیرش: بالا')).toBeInTheDocument();
    expect(within(card).getByText('۱۷')).toBeInTheDocument();
  });

  it('has no card for a customer who never took the quiz', async () => {
    renderApp(`/sales/customers/${String(ERFAN)}`);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: TITLE })).not.toBeInTheDocument();
  });
});
