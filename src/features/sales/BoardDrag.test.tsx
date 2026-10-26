import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/Toast';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import { BOARD_STAGES, boardQuery, type BoardData } from './api';
import { SalesBoard } from './components/SalesBoard';

let data: BoardData;
let client: QueryClient;
const card = {
  lead: 11,
  customer: 101,
  name: 'Sara',
  score: 80,
  summary: 'Application consultation',
  amount: 1_000_000,
  paid: null,
  stage_since: '2026-01-01T00:00:00Z',
  next: { kind: 'call_now' as const },
};
function Harness() {
  const { data } = useSuspenseQuery(boardQuery);
  return <SalesBoard data={data} />;
}
async function setup(language = 'en') {
  await i18n.changeLanguage(language);
  await i18n.loadNamespaces('sales');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(boardQuery.queryKey, data);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Suspense>
          <Harness />
          <Toaster />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
function column(stage: (typeof BOARD_STAGES)[number]) {
  return screen.getByRole('region', { name: i18n.t(`stage.${stage}`, { ns: 'sales' }) });
}
function handle(name = 'Sara') {
  return screen.getByRole('button', { name: i18n.t('board.move.title', { ns: 'sales', name }) });
}
function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
    width,
    height,
    toJSON() {},
  };
}
// Give the drag engine real column geometry; jsdom has no layout. Reverse it for RTL.
function layout(rtl = false) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const section = this.closest('section');
    const stage = section?.getAttribute('aria-labelledby')?.replace('col-', '');
    const index = BOARD_STAGES.findIndex((value) => value === stage);
    if (index < 0) return rect(0, 0, 1320, 600);
    const x = (rtl ? 5 - index : index) * 220;
    return this === section ? rect(x, 0, 204, 500) : rect(x + 10, 100, 184, 160);
  });
}
async function keyboardPick(user: ReturnType<typeof userEvent.setup>) {
  act(() => handle().focus());
  await user.keyboard('[Space]');
  // KeyboardSensor attaches its document listener on the next task.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

beforeEach(() => {
  data = {
    open_value: 0,
    columns: BOARD_STAGES.map((stage) => ({
      stage,
      count: stage === 'new' || stage === 'draft' ? 1 : 0,
      value: 0,
      cards:
        stage === 'new'
          ? [{ ...card }]
          : stage === 'draft'
            ? [{ ...card, lead: 12, customer: 102, name: 'Ali' }]
            : [],
    })),
    lost: { total: 0, reasons: [] },
  };
  server.use(http.get('/api/sales/v1/board/', () => HttpResponse.json(data)));
});
afterEach(() => {
  client.clear();
  vi.restoreAllMocks();
});

describe('sales board card moves', () => {
  it.each(['en', 'fa'])(
    'keyboard moves into an empty column and saves exactly once (%s)',
    async (language) => {
      const post = vi.fn();
      server.use(
        http.post('/api/sales/v1/leads/bulk/', async ({ request }) => {
          post(await request.json());
          data = {
            ...data,
            columns: data.columns.map((column) =>
              column.stage === 'new'
                ? { ...column, cards: [], count: 0 }
                : column.stage === 'contacted'
                  ? { ...column, cards: [{ ...card, next: null }], count: 1 }
                  : column,
            ),
          };
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const user = await setup(language);
      layout(language === 'fa');
      await keyboardPick(user);
      await user.keyboard(language === 'fa' ? '[ArrowLeft]' : '[ArrowRight]');
      await waitFor(() => expect(column('contacted')).toHaveClass('ring-2'));
      await user.keyboard('[Space]');
      await waitFor(() =>
        expect(post).toHaveBeenCalledExactlyOnceWith({ ids: [11], stage: 'contacted' }),
      );
      await waitFor(() =>
        expect(within(column('new')).queryByRole('link')).not.toBeInTheDocument(),
      );
      expect(within(column('contacted')).getByRole('link')).toHaveTextContent('Sara');
      await waitFor(() => expect(handle()).toHaveFocus());
      expect(
        await screen.findByText(
          i18n.t('board.move.saved', {
            ns: 'sales',
            name: 'Sara',
            stage: i18n.t('stage.contacted', { ns: 'sales' }),
          }),
        ),
      ).toBeInTheDocument();
    },
  );

  it('Escape cancels a keyboard drag and dropping in the source column sends no request', async () => {
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post('/api/sales/v1/leads/bulk/', post));
    const user = await setup();
    layout();
    await keyboardPick(user);
    await user.keyboard('[ArrowRight][Escape]');
    expect(within(column('new')).getByRole('link')).toHaveTextContent('Sara');
    await keyboardPick(user);
    await user.keyboard('[Space]');
    expect(post).not.toHaveBeenCalled();
  });

  it('mouse dragging crosses the activation threshold, highlights a target and saves', async () => {
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post('/api/sales/v1/leads/bulk/', post));
    await setup();
    layout();
    fireEvent.mouseDown(handle(), { button: 0, clientX: 180, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 188, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 120 });
    await waitFor(() => expect(column('contacted')).toHaveClass('ring-2'));
    fireEvent.mouseUp(document);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
  });

  it('release outside the board cancels, including over contract-managed columns', async () => {
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post('/api/sales/v1/leads/bulk/', post));
    await setup();
    layout();
    for (const x of [920, 1600]) {
      fireEvent.mouseDown(handle(), { button: 0, clientX: 180, clientY: 120 });
      fireEvent.mouseMove(document, { clientX: 188, clientY: 120 });
      fireEvent.mouseMove(document, { clientX: x, clientY: 120 });
      fireEvent.mouseUp(document);
    }
    expect(post).not.toHaveBeenCalled();
    expect(within(column('new')).getByRole('link')).toHaveTextContent('Sara');
    expect(screen.queryByRole('button', { name: 'Move Ali' })).not.toBeInTheDocument();
  });

  it('click alternative updates immediately, locks further moves, and restores the board on failure', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const post = vi.fn(async () => {
      await pending;
      return HttpResponse.json({}, { status: 500 });
    });
    server.use(http.post('/api/sales/v1/leads/bulk/', post));
    const user = await setup();
    await user.click(handle());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('radio', { name: 'Won' })).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('radio', { name: i18n.t('stage.offer', { ns: 'sales' }) }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Move card' }));
    await waitFor(() =>
      expect(within(column('offer')).getByRole('link')).toHaveTextContent('Sara'),
    );
    expect(handle()).toBeDisabled();
    expect(client.getQueryData(boardQuery.queryKey)?.open_value).toBe(1_000_000);
    await user.click(handle());
    expect(post).toHaveBeenCalledOnce();
    act(() => {
      finish();
    });
    expect(
      await screen.findByText(
        'Could not move Sara. The previous stage has been restored. Try again.',
      ),
    ).toBeInTheDocument();
    expect(within(column('new')).getByRole('link')).toHaveTextContent('Sara');
    expect(within(column('offer')).queryByRole('link')).not.toBeInTheDocument();
    expect(client.getQueryData(boardQuery.queryKey)?.open_value).toBe(0);
    expect(handle()).toBeEnabled();
  });

  it('touch long press can drag to another column', async () => {
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post('/api/sales/v1/leads/bulk/', post));
    await setup();
    layout();
    const touch = (x: number) => ({ identifier: 1, clientX: x, clientY: 120 });
    fireEvent.touchStart(handle(), { touches: [touch(180)] });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 230));
    });
    fireEvent.touchMove(handle(), { touches: [touch(300)] });
    await waitFor(() => expect(column('contacted')).toHaveClass('ring-2'));
    fireEvent.touchEnd(handle(), { changedTouches: [touch(300)] });
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
  });
});
