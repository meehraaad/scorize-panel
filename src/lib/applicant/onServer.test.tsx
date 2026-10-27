import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { ON_SERVER } from './onServer';

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const SARA = 1;

describe('features by what Django serves', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('leaves only the Turkey programme and the to-do box off', () => {
    expect(Object.entries(ON_SERVER).filter(([, on]) => !on)).toEqual([
      ['turkey', false],
      ['activities', false],
    ]);
  });

  it('opens the guest home on the admission-chance quiz', async () => {
    loginAs(2); // Maryam: no contract
    renderApp('/');
    // At phone width the quiz is one card that opens its questions in a sheet.
    expect(await screen.findByRole('button', { name: 'دیدن شانس من' })).toBeInTheDocument();
    // The readiness card's first step leads to the full quiz page.
    expect(screen.getByRole('link', { name: 'شروع تخمین' })).toHaveAttribute('href', '/estimate');
  });

  it('offers the GPA calculator, webinar sign-up and package pages on the services page', async () => {
    loginAs(SARA);
    renderApp('/services');
    const nav = await screen.findByRole('navigation', { name: 'بخش‌های این صفحه' });
    expect(within(nav).getByRole('link', { name: /GPA/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /GPA/ })).toBeInTheDocument();
    expect(screen.getByText('وبینار پیش رو')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /آمادگی تافل ۱۲۰/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/services\/packages\/\d+$/),
    );
  });

  it('opens the recommendation, professor-list, PS and DS forms', async () => {
    loginAs(SARA);
    renderApp('/documents/ps');
    expect(
      await screen.findByRole('heading', { name: 'اطلاعات بیانیه‌ی شخصی', level: 1 }),
    ).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'سفارش‌های نگارش شما' });
    for (const name of ['توصیه‌نامه', 'بیانیه‌ی تنوع \\(DS\\)', 'فهرست استادها'])
      expect(within(tabs).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
  });

  it('sends the Turkey page to "coming soon"', async () => {
    loginAs(SARA);
    renderApp('/turkey');
    expect(
      await screen.findByText('این صفحه به‌زودی با طراحی جدید آماده می‌شود.'),
    ).toBeInTheDocument();
  });
});
