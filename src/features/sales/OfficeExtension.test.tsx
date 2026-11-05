import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import { OfficeExtension } from './components/OfficeExtension';

const ENDPOINT = '/api/sales/v1/calls/extension/';

function mount() {
  return render(
    <QueryClientProvider client={queryClient}>
      <OfficeExtension />
    </QueryClientProvider>,
  );
}

describe('office desk phone extension', () => {
  beforeEach(async () => {
    queryClient.clear();
    await i18n.changeLanguage('en');
    await i18n.loadNamespaces('sales');
  });

  it('saves Persian digits as the seller’s extension and can remove it', async () => {
    let saved: unknown = 'not sent';
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json({ extension: null })),
      http.put(ENDPOINT, async ({ request }) => {
        saved = ((await request.json()) as { extension: unknown }).extension;
        return HttpResponse.json({ extension: saved });
      }),
    );
    const browser = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Desk phone extension');
    await browser.type(field, '۱۰۴');
    await browser.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Remove extension' })).toBeInTheDocument();
    expect(saved).toBe('104');
    await browser.click(screen.getByRole('button', { name: 'Remove extension' }));
    await screen.findByRole('button', { name: 'Save' });
    expect(saved).toBeNull();
  });

  it('rejects a malformed number and explains a taken one', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json({ extension: null })),
      http.put(ENDPOINT, () => HttpResponse.json({ detail: 'taken' }, { status: 409 })),
    );
    const browser = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Desk phone extension');
    await browser.type(field, '04');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await browser.clear(field);
    await browser.type(field, '105');
    await browser.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Another seller has picked this extension/)).toBeInTheDocument();
  });
});
