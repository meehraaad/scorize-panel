import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('fa');
});

it('seller shell and outreach stay usable while activity waits; insights fetch only when seen', async () => {
  localStorage.setItem('scorize.mock.session', '3');
  // The month and the chances load when they scroll into view: a stand-in observer to scroll.
  const observers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const insights = vi.fn();
  server.use(
    http.get('/api/sales/v1/today/activity/', async () => {
      await held;
      return HttpResponse.json({
        tasks: { overdue: 0, requests: 0, team: 0 },
        consultations: { count: 0, page_size: 20, results: [] },
        calendar_calls: { count: 0, page_size: 50, results: [] },
      });
    }),
    http.get('/api/sales/v1/today/insights/', () => {
      insights();
      return HttpResponse.json({}, { status: 400 });
    }),
  );
  try {
    renderApp('/sales');
    expect(
      await screen.findByRole('region', { name: 'پیگیری‌ها و تماس‌های امروز' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ثبت لید دستی' })).toBeInTheDocument();
    expect(insights).not.toHaveBeenCalled();
    act(() => {
      for (const callback of observers) callback([{ isIntersecting: true }]);
    });
    await waitFor(() => expect(insights).toHaveBeenCalledOnce());
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.sectionTitle'));
    expect(screen.getByRole('region', { name: 'پیگیری‌ها و تماس‌های امروز' })).toBeInTheDocument();
  } finally {
    release();
    vi.unstubAllGlobals();
  }
});

it('supervisor waiting cases render when the board fails and can retry independently', async () => {
  localStorage.setItem('scorize.mock.session', '2');
  const board = vi.fn(() => HttpResponse.json({}, { status: 400 }));
  server.use(http.get('/api/supervisor/v1/today/board/', board));
  renderApp('/supervisor');
  expect(await screen.findByRole('region', { name: 'پرونده‌های منتظر شما' })).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.sectionTitle'));
  await userEvent.click(screen.getByRole('button', { name: i18n.t('errors.retry') }));
  await waitFor(() => expect(board).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('region', { name: 'پرونده‌های منتظر شما' })).toBeInTheDocument();
});

it('pages the supervisor board on the server without hiding the waiting section', async () => {
  localStorage.setItem('scorize.mock.session', '2');
  const pages: string[] = [];
  server.use(
    http.get('/api/supervisor/v1/today/board/', ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '1';
      pages.push(page);
      return HttpResponse.json({
        count: 21,
        page_size: 20,
        results: [
          {
            application: Number(page),
            applicant: { id: 1240, name: 'Applicant' },
            university: `University page ${page}`,
            program: '',
            deadline: '2026-11-01',
            status: 'ready',
          },
        ],
      });
    }),
  );
  renderApp('/supervisor');
  expect(await screen.findByText('University page 1')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: i18n.t('pager.next') }));
  expect(await screen.findByText('University page 2')).toBeInTheDocument();
  expect(pages).toEqual(['1', '2']);
  expect(screen.getByRole('region', { name: 'پرونده‌های منتظر شما' })).toBeInTheDocument();
});
