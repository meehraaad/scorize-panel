import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { boardQuery } from '@/features/sales/api';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const NIMA = 3; // seller

describe('preload on intent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', String(NIMA));
    await i18n.changeLanguage('fa');
  });

  it('starts the next page’s data when its link is focused, before the click', async () => {
    const router = renderApp('/sales');
    const navigation = { name: i18n.t('panels.sales.nav.label') };
    await screen.findAllByRole('navigation', navigation);
    expect(queryClient.getQueryState(boardQuery.queryKey)).toBeUndefined();

    // The board's request has started (it may still be on its way). The link is looked up on each
    // try: the panel frame can re-render while it loads, and a link found earlier can be detached.
    await waitFor(() => {
      const [nav] = screen.getAllByRole('navigation', navigation);
      if (!nav) throw new Error('No panel nav');
      within(nav)
        .getByRole('link', { name: i18n.t('panels.sales.nav.board') })
        .focus();
      expect(queryClient.getQueryState(boardQuery.queryKey)).toBeDefined();
    });
    // Nothing navigated: the data waits in the cache for the click.
    expect(router.state.location.pathname).toBe('/sales');
  });
});
