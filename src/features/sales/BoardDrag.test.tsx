import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/Toast';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import { BOARD_STAGES, boardQuery, type BoardData, type BoardStage } from './api';
import { boardOrderKey } from './boardOrder';
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
  seller: null,
  next: { kind: 'call_now' as const },
};
/** Column keys in order: the team columns are 1–3 (contacted, consulted, offer). */
const KEYS = ['new', '1', '2', '3', 'draft', 'won'];
const MOVE = '/api/sales/v1/leads/:id/move/';
const saveAndMove = async () =>
  fireEvent.click(await screen.findByRole('button', { name: 'Save and move' }));
function Harness() {
  const { data } = useSuspenseQuery(boardQuery);
  return <SalesBoard data={data} ownerId={3} sellerName="Nima" />;
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
function column(stage: BoardStage) {
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
    const index = KEYS.findIndex((value) => value === stage);
    if (index < 0) {
      // Portaled previews retain the active card's size and original position, including RTL.
      if (
        this === document.body ||
        this === document.documentElement ||
        this.hasAttribute('aria-busy')
      )
        return rect(0, 0, 1320, 900);
      const active = document.querySelector('[data-move-lead][aria-pressed="true"]');
      const activeStage = active
        ?.closest('section')
        ?.getAttribute('aria-labelledby')
        ?.replace('col-', '');
      const stageIndex = Math.max(
        0,
        KEYS.findIndex((value) => value === activeStage),
      );
      const item = active?.closest('li');
      const position = item ? Array.from(item.parentElement?.children ?? []).indexOf(item) : 0;
      return rect(
        (rtl ? 5 - stageIndex : stageIndex) * 220 + 10,
        100 + Math.max(0, position) * 180,
        184,
        160,
      );
    }
    const x = (rtl ? 5 - index : index) * 220;
    const item = this.closest('li');
    const position = item ? Array.from(item.parentElement?.children ?? []).indexOf(item) : 0;
    return this === section
      ? rect(x, 0, 204, 900)
      : rect(x + 10, 100 + Math.max(0, position) * 180, 184, 160);
  });
}
async function keyboardPick(user: ReturnType<typeof userEvent.setup>, name = 'Sara') {
  act(() => handle(name).focus());
  await user.keyboard('[Space]');
  // KeyboardSensor attaches its document listener on the next task.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

beforeEach(() => {
  localStorage.clear();
  data = {
    open_value: 0,
    columns: BOARD_STAGES.map((stage, index) => ({
      stage,
      id: index > 0 && index < 4 ? index : null,
      name: null,
      max_days: null,
      activities:
        index > 0 && index < 4
          ? [
              {
                id: 100 + index,
                kind: 'follow_up' as const,
                required: true,
                settings: { days: 1, hour: 10, text: '' },
              },
            ]
          : [],
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
    sellers: [],
  };
  server.use(http.get('/api/sales/v1/board/', () => HttpResponse.json(data)));
});
afterEach(async () => {
  cleanup();
  client.clear();
  // dnd-kit keeps its document click/selection guard for 50 ms after a pointer drop.
  // Let that teardown finish before the next test creates a different board.
  await new Promise<void>((resolve) => setTimeout(resolve, 60));
  vi.restoreAllMocks();
});

describe('sales board card moves', () => {
  it.each(['en', 'fa'])(
    'keyboard moves into an empty column and saves exactly once (%s)',
    async (language) => {
      const post = vi.fn();
      server.use(
        http.post(MOVE, async ({ request }) => {
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
      expect(post).not.toHaveBeenCalled();
      await user.click(
        await screen.findByRole('button', {
          name: i18n.t('board.enter.save', { ns: 'sales' }),
        }),
      );
      await waitFor(() =>
        expect(post).toHaveBeenCalledExactlyOnceWith({
          to: '1',
          steps: {
            follow_up: {
              text: i18n.t('board.enter.followUpText', { ns: 'sales', name: 'Sara' }),
              due_at: expect.any(String) as string,
            },
          },
        }),
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
    server.use(http.post(MOVE, post));
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
    server.use(http.post(MOVE, post));
    await setup();
    layout();
    fireEvent.mouseDown(handle(), { button: 0, clientX: 180, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 188, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 120 });
    await waitFor(() => expect(column('contacted')).toHaveClass('ring-2'));
    fireEvent.mouseUp(document);
    await saveAndMove();
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
  });

  it("the popup asks for the column's required note and shows its ready message", async () => {
    const post = vi.fn();
    server.use(
      http.post(MOVE, async ({ request }) => {
        post(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    data = {
      ...data,
      columns: data.columns.map((item) =>
        item.stage === 'offer'
          ? {
              ...item,
              name: 'Negotiation',
              activities: [
                ...item.activities,
                { id: 201, kind: 'note', required: true, settings: { text: 'What did they ask?' } },
                {
                  id: 202,
                  kind: 'message',
                  required: false,
                  settings: { template: { id: 1, title: 'Sent', text: 'Hi {customer}, {seller}' } },
                },
              ],
            }
          : item,
      ),
    };
    const user = await setup();
    await user.click(handle());
    await user.click(screen.getByRole('radio', { name: 'Negotiation' }));
    await user.click(screen.getByRole('button', { name: 'Move card' }));
    expect(await screen.findByText('Hi Sara, Nima')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and move' }));
    expect(post).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('What did they ask?'), 'The price');
    await user.click(screen.getByRole('button', { name: 'Save and move' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledExactlyOnceWith({
        to: '3',
        steps: {
          follow_up: { text: 'Follow up with Sara', due_at: expect.any(String) as string },
          note: { text: 'The price' },
        },
      }),
    );
  });

  it('putting the card back in the popup sends nothing, and back to new needs no popup', async () => {
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post(MOVE, post));
    data = {
      ...data,
      columns: data.columns.map((item) =>
        item.stage === 'new'
          ? { ...item, cards: [], count: 0 }
          : item.stage === 'contacted'
            ? { ...item, cards: [{ ...card, next: null }], count: 1 }
            : item,
      ),
    };
    const user = await setup();
    await user.click(handle());
    await user.click(screen.getByRole('radio', { name: 'Consulted' }));
    await user.click(screen.getByRole('button', { name: 'Move card' }));
    await user.click(await screen.findByRole('button', { name: 'Put the card back' }));
    expect(post).not.toHaveBeenCalled();
    expect(within(column('contacted')).getByRole('link')).toHaveTextContent('Sara');
    await user.click(handle());
    await user.click(screen.getByRole('radio', { name: 'New' }));
    await user.click(screen.getByRole('button', { name: 'Move card' }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
  });

  it('release outside the board cancels, including over contract-managed columns', async () => {
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post(MOVE, post));
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
    expect(screen.getByRole('button', { name: 'Move Ali' })).toBeEnabled();
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
    server.use(http.post(MOVE, post));
    const user = await setup();
    await user.click(handle());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('radio', { name: 'Won' })).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('radio', { name: i18n.t('stage.offer', { ns: 'sales' }) }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Move card' }));
    await user.click(await screen.findByRole('button', { name: 'Save and move' }));
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
    server.use(http.post(MOVE, post));
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
    await saveAndMove();
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
  });
});

function addCards(stage: BoardStage = 'new') {
  data = {
    ...data,
    columns: data.columns.map((column) =>
      column.stage === stage
        ? {
            ...column,
            count: column.cards.length + 2,
            cards: [
              ...column.cards,
              { ...card, lead: 13, customer: 103, name: 'Mina' },
              { ...card, lead: 14, customer: 104, name: 'Kian' },
            ],
          }
        : column,
    ),
  };
}
const customerOrder = (stage: BoardStage = 'new') =>
  within(column(stage))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));

describe('manual ordering within a sales stage', () => {
  it('mouse reorders to the last card and survives both refetch and remount without changing stages', async () => {
    addCards();
    const post = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post(MOVE, post));
    await setup();
    layout();
    fireEvent.mouseDown(handle(), { button: 0, clientX: 180, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 188, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 530 });
    fireEvent.mouseUp(document);
    await waitFor(() =>
      expect(customerOrder()).toEqual([
        '/sales/customers/103',
        '/sales/customers/104',
        '/sales/customers/101',
      ]),
    );
    expect(JSON.parse(localStorage.getItem(boardOrderKey(3)) ?? '{}')).toMatchObject({
      new: [13, 14, 11],
    });
    await act(async () => {
      await client.invalidateQueries({ queryKey: boardQuery.queryKey });
    });
    expect(customerOrder()[2]).toBe('/sales/customers/101');
    cleanup();
    client.clear();
    await setup();
    expect(customerOrder()[2]).toBe('/sales/customers/101');
    expect(post).not.toHaveBeenCalled();
  });

  it.each(['en', 'fa'])(
    'Up/Down reorders in both directions with keyboard (%s)',
    async (language) => {
      addCards();
      const user = await setup(language);
      layout(language === 'fa');
      await keyboardPick(user);
      await user.keyboard('[ArrowDown][Space]');
      await waitFor(() =>
        expect(customerOrder()).toEqual([
          '/sales/customers/103',
          '/sales/customers/101',
          '/sales/customers/104',
        ]),
      );
      await waitFor(() => expect(handle()).toHaveFocus());
      await keyboardPick(user);
      await user.keyboard('[ArrowUp][Space]');
      await waitFor(() => expect(customerOrder()[0]).toBe('/sales/customers/101'));
    },
  );

  it('cancelling a reorder leaves the list and saved preferences unchanged', async () => {
    addCards();
    const user = await setup();
    layout();
    await keyboardPick(user);
    await user.keyboard('[ArrowDown][Escape]');
    expect(customerOrder()[0]).toBe('/sales/customers/101');
    expect(localStorage.getItem(boardOrderKey(3))).toBeNull();
  });

  it('touch long press can reorder within the same column', async () => {
    addCards();
    await setup();
    layout();
    const touch = (y: number) => ({ identifier: 1, clientX: 150, clientY: y });
    fireEvent.touchStart(handle(), { touches: [touch(120)] });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 230));
    });
    fireEvent.touchMove(handle(), { touches: [touch(530)] });
    fireEvent.touchEnd(handle(), { changedTouches: [touch(530)] });
    await waitFor(() => expect(customerOrder()[2]).toBe('/sales/customers/101'));
  });

  it.each(['draft', 'won'] as const)(
    '%s can be reordered through move options without changing stage',
    async (stage) => {
      addCards(stage);
      const user = await setup();
      await user.click(handle(stage === 'draft' ? 'Ali' : 'Mina'));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Move down' }));
      expect(customerOrder(stage)).toEqual(
        stage === 'draft'
          ? ['/sales/customers/103', '/sales/customers/102', '/sales/customers/104']
          : ['/sales/customers/104', '/sales/customers/103'],
      );
      expect(data.columns.find((column) => column.stage === stage)?.count).toBe(
        stage === 'draft' ? 3 : 2,
      );
    },
  );

  it('a storage failure preserves the previous order and explains the failure', async () => {
    addCards();
    const user = await setup();
    layout();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });
    await keyboardPick(user);
    await user.keyboard('[ArrowDown][Space]');
    expect(
      await screen.findByText('Could not save the order in this browser. The card has not moved.'),
    ).toBeInTheDocument();
    expect(customerOrder()[0]).toBe('/sales/customers/101');
  });
});
