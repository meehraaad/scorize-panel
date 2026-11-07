import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import type { MobileExtensionState } from '@/lib/sales/phoneCalls';
import { server } from '@/test/server';
import { MobileExtension } from './components/MobileExtension';

const ENDPOINT = '/api/sales/v1/calls/mobile/';
const EMPTY: MobileExtensionState = {
  available: true,
  status: 'none',
  extension: null,
  password: null,
  domain: null,
  server: null,
};
const READY: MobileExtensionState = {
  available: true,
  status: 'ready',
  extension: '302',
  password: 'Secret123Secret123Secret123',
  domain: 'scorize.sitakpbx',
  server: '77.238.105.91:5061',
};

function mount() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MobileExtension />
    </QueryClientProvider>,
  );
}

describe('mobile extension', () => {
  beforeEach(async () => {
    queryClient.clear();
    await i18n.changeLanguage('en');
    await i18n.loadNamespaces('sales');
  });

  it('requests an extension and shows that it is being made', async () => {
    let body: unknown;
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json(EMPTY)),
      http.post(ENDPOINT, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...EMPTY, status: 'pending' });
      }),
    );
    const browser = userEvent.setup();
    mount();
    await browser.click(await screen.findByRole('button', { name: 'Request a mobile extension' }));
    expect(await screen.findByText(/being created/)).toBeInTheDocument();
    expect(body).toEqual({ reset: false });
  });

  it('keeps the password hidden until asked', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json(READY)));
    const browser = userEvent.setup();
    mount();
    expect(await screen.findByText('302')).toBeInTheDocument();
    expect(screen.queryByText(READY.password as string)).not.toBeInTheDocument();
    await browser.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByText(READY.password as string)).toBeInTheDocument();
    expect(screen.getByText('scorize.sitakpbx')).toBeInTheDocument();
  });

  it('asks before changing the password', async () => {
    let body: unknown = 'not sent';
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json(READY)),
      http.post(ENDPOINT, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...EMPTY, status: 'pending' });
      }),
    );
    const browser = userEvent.setup();
    mount();
    await browser.click(await screen.findByRole('button', { name: 'Change password' }));
    await browser.click(screen.getByRole('button', { name: 'Keep this password' }));
    expect(body).toBe('not sent');
    await browser.click(screen.getByRole('button', { name: 'Change password' }));
    await browser.click(screen.getByRole('button', { name: 'Yes, change it' }));
    expect(await screen.findByText(/being created/)).toBeInTheDocument();
    expect(body).toEqual({ reset: true });
  });

  it('offers a retry when the PBX could not make it', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ ...EMPTY, status: 'failed' })));
    mount();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('stays out of the way until the server offers it', async () => {
    let asked = false;
    server.use(
      http.get(ENDPOINT, () => {
        asked = true;
        return HttpResponse.json({ ...EMPTY, available: false });
      }),
    );
    const { container } = mount();
    await expect.poll(() => asked).toBe(true);
    expect(container).toBeEmptyDOMElement();
  });
});
