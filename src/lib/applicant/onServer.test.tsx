import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};
const SARA = 1;

describe('features Django does not serve yet', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('are not offered on the services page', async () => {
    loginAs(SARA);
    renderApp('/services');
    const nav = await screen.findByRole('navigation', { name: 'بخش‌های این صفحه' });
    // No GPA calculator (its result comes from the server) and no webinar sign-up.
    expect(within(nav).queryByRole('link', { name: /GPA/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /GPA/ })).toBeNull();
    expect(screen.queryByText('وبینار پیش رو')).toBeNull();
    // Bought packages are listed, without a detail page to open.
    expect(screen.getByText('آمادگی تافل ۱۲۰')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /آمادگی تافل/ })).toBeNull();
  });

  it('send their pages to "coming soon"', async () => {
    loginAs(SARA);
    renderApp('/turkey');
    expect(
      await screen.findByText('این صفحه به‌زودی با طراحی جدید آماده می‌شود.'),
    ).toBeInTheDocument();
  });
});
