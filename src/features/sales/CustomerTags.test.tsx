import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';
import { toasts } from '@/test/toasts';
import { tagKey } from './api';

const NIMA = 3; // seller (src/mocks/handlers.ts)
const REZA = 4; // sales manager
const ERFAN = 105; // carries the «وی‌آی‌پی» tag (src/mocks/salesTags.ts)

const loginAs = (id: number) => {
  localStorage.setItem('scorize.mock.session', String(id));
};

describe('customer tags (S49)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('one key for the same word, however it is typed', () => {
    expect(tagKey(' وي  آي پي ')).toBe(tagKey('وی‌آی‌پی'));
    expect(tagKey('Needs IELTS')).toBe(tagKey('needs  ielts'));
    expect(tagKey('کانادا')).not.toBe(tagKey('آلمان'));
  });

  it('customer page: adds a tag from the list and removes one', async () => {
    loginAs(NIMA);
    const user = userEvent.setup();
    renderApp(`/sales/customers/${String(ERFAN)}`);
    const tags = await screen.findByRole('list', { name: 'برچسب‌ها' });
    expect(within(tags).getByText('وی‌آی‌پی')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'برچسب‌ها' }));
    const dialog = await screen.findByRole('dialog', { name: 'برچسب‌های مشتری' });
    // Archived tags can't be added.
    expect(within(dialog).queryByText('کمپین تابستان')).not.toBeInTheDocument();
    await user.type(within(dialog).getByRole('searchbox'), 'بودجه');
    await user.click(within(dialog).getByRole('checkbox', { name: 'مشکل بودجه' }));
    await user.click(within(dialog).getByRole('button', { name: 'تمام' }));

    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'برچسب‌ها' })).getByText('مشکل بودجه'),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'برداشتن برچسب وی‌آی‌پی' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'برچسب‌ها' })).queryByText('وی‌آی‌پی'),
      ).not.toBeInTheDocument(),
    );
  });

  it('leads: each row shows its tags; the tag filter keeps the customers with it', async () => {
    loginAs(NIMA);
    const user = userEvent.setup();
    renderApp('/sales/leads');
    const row = await screen.findByRole('list', { name: /^برچسب‌های / });
    expect(within(row).getByText('وی‌آی‌پی')).toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText('برچسب'), 'وی‌آی‌پی');
    await waitFor(() =>
      expect(screen.getAllByRole('list', { name: /^برچسب‌های / })).toHaveLength(1),
    );
    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === `/sales/customers/${String(ERFAN)}`);
    expect(links.length).toBeGreaterThan(0);
  });

  it('manager: refuses the same word typed another way, adds a new tag', async () => {
    loginAs(REZA);
    const user = userEvent.setup();
    renderApp('/sales/manager/tags');
    // The new tag's field comes first; each tag on the list has its own.
    const [field] = await screen.findAllByRole('textbox', { name: 'نام برچسب' });
    if (!field) throw new Error('no name field');
    await user.type(field, 'وي آي پي');
    expect(screen.getByText('«وی‌آی‌پی» در فهرست هست.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن' })).toBeDisabled();

    await user.clear(field);
    await user.type(field, 'دانشجوی دکتری');
    await user.click(screen.getByRole('button', { name: 'افزودن' }));
    expect(await toasts().findByText('برچسب اضافه شد.')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('دانشجوی دکتری')).toBeInTheDocument();
  });
});
